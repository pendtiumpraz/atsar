// Figure service — business logic for the `figures` resource.
// All CRUD + soft-delete + trash flows live here.  Route handlers should
// NEVER touch Drizzle directly for this table.
//
// See docs/BACKEND.md §1 (No raw CRUD), §4 (Soft Delete), §11 (Audit).

import { and, asc, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import { figures, figureCategories, figureLocations, figureRelations } from '@athar/db/schema'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'
import type {
  CreateFigureInput,
  ListFiguresQuery,
  ListTrashQuery,
  UpdateFigureInput,
} from './figure.schemas.js'

// ── Types ─────────────────────────────────────────────────────────────
type FigureRow = typeof figures.$inferSelect
type FigureInsert = typeof figures.$inferInsert

export interface FigureWithRelations extends FigureRow {
  category: typeof figureCategories.$inferSelect | null
  relations: (typeof figureRelations.$inferSelect)[]
  locations: (typeof figureLocations.$inferSelect)[]
}

export interface PaginatedFigures {
  rows: FigureRow[]
  total: number
  page: number
  perPage: number
}

// ── List ──────────────────────────────────────────────────────────────
export async function list(input: ListFiguresQuery): Promise<PaginatedFigures> {
  const { q, category, gender, page, perPage } = input
  const offset = (page - 1) * perPage

  // Build WHERE clauses incrementally.
  const where = [isNull(figures.deletedAt)]

  if (gender) where.push(eq(figures.gender, gender))

  if (category) {
    // Resolve category slug → id via a subquery.
    where.push(
      sql`${figures.categoryId} IN (SELECT ${figureCategories.id} FROM ${figureCategories} WHERE ${figureCategories.slug} = ${category} AND ${figureCategories.deletedAt} IS NULL)`,
    )
  }

  if (q) {
    // Hybrid: tsvector FTS over Indonesian full name + ILIKE fallback on
    // Arabic / kunyah / laqab.  `plainto_tsquery` is forgiving with
    // non-language input (free-form user search).
    const like = `%${q}%`
    where.push(
      or(
        sql`to_tsvector('simple', ${figures.nameFullId}) @@ plainto_tsquery('simple', ${q})`,
        ilike(figures.nameFullId, like),
        ilike(figures.nameFullAr, like),
        ilike(figures.kunyahAr, like),
        ilike(figures.kunyahId, like),
        ilike(figures.laqabAr, like),
        ilike(figures.laqabId, like),
      )!,
    )
  }

  const whereExpr = and(...where)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(figures)
      .where(whereExpr)
      .orderBy(asc(figures.nameFullId))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(figures)
      .where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

// ── Get by slug (active) ──────────────────────────────────────────────
export async function getBySlug(slug: string): Promise<FigureWithRelations> {
  const row = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const [category, relations, locs] = await Promise.all([
    db.query.figureCategories.findFirst({
      where: eq(figureCategories.id, row.categoryId),
    }),
    db
      .select()
      .from(figureRelations)
      .where(and(eq(figureRelations.figureId, row.id), isNull(figureRelations.deletedAt)))
      .orderBy(desc(figureRelations.createdAt))
      .limit(20),
    db
      .select()
      .from(figureLocations)
      .where(and(eq(figureLocations.figureId, row.id), isNull(figureLocations.deletedAt)))
      .orderBy(desc(figureLocations.createdAt))
      .limit(20),
  ])

  return {
    ...row,
    category: category ?? null,
    relations,
    locations: locs,
  }
}

// ── Get by id (any state — used by trash flows) ───────────────────────
async function getById(id: string): Promise<FigureRow> {
  const row = await db.query.figures.findFirst({ where: eq(figures.id, id) })
  if (!row) throw new ApiError('NOT_FOUND', `Figure not found: ${id}`)
  return row
}

// ── Create ────────────────────────────────────────────────────────────
export async function create(data: CreateFigureInput, actorId: string): Promise<FigureRow> {
  // Slug uniqueness (active rows only — soft-deleted slugs are fine).
  const existing = await db.query.figures.findFirst({
    where: and(eq(figures.slug, data.slug), isNull(figures.deletedAt)),
  })
  if (existing) {
    throw new ApiError('CONFLICT', `Slug already in use: ${data.slug}`, {
      fieldErrors: { slug: 'Slug sudah dipakai' },
    })
  }

  const insertValues: FigureInsert = {
    ...data,
    status: data.status ?? 'draft',
    rijalGrade: data.rijalGrade ?? 'unverified',
    createdBy: actorId,
    updatedBy: actorId,
  }

  const [inserted] = await db.insert(figures).values(insertValues).returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert figure')

  await auditLog.write({
    action: 'create',
    resourceType: 'figure',
    resourceId: inserted.id,
    actorId,
    diff: { after: inserted },
  })

  return inserted
}

// ── Update (by slug) ──────────────────────────────────────────────────
export async function update(
  slug: string,
  data: UpdateFigureInput,
  actorId: string,
): Promise<FigureRow> {
  const before = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
  })
  if (!before) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  // If slug changing, enforce uniqueness against other active rows.
  if (data.slug && data.slug !== slug) {
    const clash = await db.query.figures.findFirst({
      where: and(
        eq(figures.slug, data.slug),
        isNull(figures.deletedAt),
        ne(figures.id, before.id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Slug already in use: ${data.slug}`, {
        fieldErrors: { slug: 'Slug sudah dipakai' },
      })
    }
  }

  const [updated] = await db
    .update(figures)
    .set({
      ...data,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(figures.id, before.id))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to update figure')

  await auditLog.write({
    action: 'update',
    resourceType: 'figure',
    resourceId: updated.id,
    actorId,
    diff: { before, after: updated },
  })

  return updated
}

// ── Soft delete (by slug) — cascade to relations + locations ──────────
export async function softDelete(slug: string, actorId: string): Promise<void> {
  const row = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const now = new Date()

  // Cascade atomically via Neon's HTTP batch (single round-trip, single
  // implicit transaction).  Neon-http intentionally does not expose a full
  // `db.transaction` — use `db.batch([...])` instead.
  await db.batch([
    db
      .update(figures)
      .set({ deletedAt: now, deletedBy: actorId, updatedBy: actorId })
      .where(eq(figures.id, row.id)),
    db
      .update(figureRelations)
      .set({ deletedAt: now, deletedBy: actorId })
      .where(and(eq(figureRelations.figureId, row.id), isNull(figureRelations.deletedAt))),
    db
      .update(figureLocations)
      .set({ deletedAt: now, deletedBy: actorId })
      .where(and(eq(figureLocations.figureId, row.id), isNull(figureLocations.deletedAt))),
  ])

  await auditLog.write({
    action: 'soft_delete',
    resourceType: 'figure',
    resourceId: row.id,
    actorId,
    diff: { slug: row.slug },
  })
}

// ── Restore (by id — trash hides slug uniqueness benefits) ────────────
export async function restore(id: string, actorId: string): Promise<FigureRow> {
  const row = await getById(id)
  if (!row.deletedAt) {
    throw new ApiError('CONFLICT', 'Figure is not in trash')
  }

  // If a different active row already owns this slug, refuse.
  const clash = await db.query.figures.findFirst({
    where: and(eq(figures.slug, row.slug), isNull(figures.deletedAt), ne(figures.id, row.id)),
  })
  if (clash) {
    throw new ApiError('CONFLICT', `Cannot restore: slug "${row.slug}" already in use`, {
      fieldErrors: { slug: 'Slug sudah dipakai oleh tokoh aktif lain' },
    })
  }

  const [restored] = await db
    .update(figures)
    .set({ deletedAt: null, deletedBy: null, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(figures.id, id))
    .returning()
  if (!restored) throw new ApiError('INTERNAL_ERROR', 'Failed to restore figure')

  // Note: dependent figureRelations / figureLocations are NOT auto-restored
  // — admins may want to leave stale rows trashed.  Document in BACKEND.md.

  await auditLog.write({
    action: 'restore',
    resourceType: 'figure',
    resourceId: id,
    actorId,
  })

  return restored
}

// ── Hard delete (by id) — must already be in trash ────────────────────
export async function hardDelete(id: string, actorId: string): Promise<void> {
  const row = await getById(id)
  if (!row.deletedAt) {
    throw new ApiError('CONFLICT', 'Figure must be in trash before hard delete')
  }

  // FK `onDelete: 'cascade'` on figureRelations / figureLocations means the
  // child rows are dropped automatically.
  await db.delete(figures).where(eq(figures.id, id))

  await auditLog.write({
    action: 'hard_delete',
    resourceType: 'figure',
    resourceId: id,
    actorId,
    diff: { slug: row.slug },
  })
}

// ── List trash ────────────────────────────────────────────────────────
export async function listTrash(input: ListTrashQuery): Promise<PaginatedFigures> {
  const { page, perPage } = input
  const offset = (page - 1) * perPage

  const whereExpr = isNotNull(figures.deletedAt)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(figures)
      .where(whereExpr)
      .orderBy(desc(figures.deletedAt))
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(figures).where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

// ── Default export (namespaced) ───────────────────────────────────────
export const figureService = {
  list,
  getBySlug,
  create,
  update,
  softDelete,
  restore,
  hardDelete,
  listTrash,
}
