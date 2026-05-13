// Battle service — business logic for the `battles` resource.
// All CRUD + soft-delete + trash + phases/participants flows live here.
// Route handlers should NEVER touch Drizzle directly for these tables.
//
// See docs/BACKEND.md §1 (No raw CRUD), §4 (Soft Delete), §11 (Audit).

import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import {
  battles,
  battlePhases,
  battleParticipants,
  figures,
} from '@athar/db/schema'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'
import type {
  AddParticipantInput,
  CreateBattleInput,
  ListBattlesQuery,
  ListTrashQuery,
  UpdateBattleInput,
} from './battle.schemas.js'

// ── Types ─────────────────────────────────────────────────────────────
type BattleRow = typeof battles.$inferSelect
type BattleInsert = typeof battles.$inferInsert
type BattlePhaseRow = typeof battlePhases.$inferSelect
type BattleParticipantRow = typeof battleParticipants.$inferSelect

export interface BattleWithDetails extends BattleRow {
  phases: BattlePhaseRow[]
  participantCount: number
}

export interface ParticipantWithFigure extends BattleParticipantRow {
  figure: {
    id: string
    slug: string
    nameFullAr: string
    nameFullId: string
  } | null
}

export interface PaginatedBattles {
  rows: BattleRow[]
  total: number
  page: number
  perPage: number
}

// ── List ──────────────────────────────────────────────────────────────
export async function list(input: ListBattlesQuery): Promise<PaginatedBattles> {
  const { q, type, outcome, fromAh, toAh, locationId, page, perPage } = input
  const offset = (page - 1) * perPage

  // Build WHERE clauses incrementally.
  const where = [isNull(battles.deletedAt)]

  if (type) where.push(eq(battles.type, type))
  if (outcome) where.push(eq(battles.outcome, outcome))
  if (locationId) where.push(eq(battles.locationId, locationId))
  if (fromAh !== undefined) where.push(gte(battles.eventDateAh, fromAh))
  if (toAh !== undefined) where.push(lte(battles.eventDateAh, toAh))

  if (q) {
    // Hybrid: tsvector FTS over Indonesian name + ILIKE fallback on Arabic.
    const like = `%${q}%`
    where.push(
      or(
        sql`to_tsvector('simple', ${battles.nameId}) @@ plainto_tsquery('simple', ${q})`,
        ilike(battles.nameId, like),
        ilike(battles.nameAr, like),
      )!,
    )
  }

  const whereExpr = and(...where)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(battles)
      .where(whereExpr)
      .orderBy(asc(battles.eventDateAh), asc(battles.nameId))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(battles)
      .where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

// ── Get by slug (active) — battle + phases + participant count ────────
export async function getBySlug(slug: string): Promise<BattleWithDetails> {
  const row = await db.query.battles.findFirst({
    where: and(eq(battles.slug, slug), isNull(battles.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Battle not found: ${slug}`)

  const [phases, countRow] = await Promise.all([
    db
      .select()
      .from(battlePhases)
      .where(and(eq(battlePhases.battleId, row.id), isNull(battlePhases.deletedAt)))
      .orderBy(asc(battlePhases.phaseOrder)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(battleParticipants)
      .where(eq(battleParticipants.battleId, row.id)),
  ])

  return {
    ...row,
    phases,
    participantCount: countRow[0]?.count ?? 0,
  }
}

// ── Get by id (any state — used by trash flows) ───────────────────────
async function getById(id: string): Promise<BattleRow> {
  const row = await db.query.battles.findFirst({ where: eq(battles.id, id) })
  if (!row) throw new ApiError('NOT_FOUND', `Battle not found: ${id}`)
  return row
}

// ── Create ────────────────────────────────────────────────────────────
export async function create(data: CreateBattleInput, actorId: string): Promise<BattleRow> {
  // Slug uniqueness (active rows only — soft-deleted slugs are fine).
  const existing = await db.query.battles.findFirst({
    where: and(eq(battles.slug, data.slug), isNull(battles.deletedAt)),
  })
  if (existing) {
    throw new ApiError('CONFLICT', `Slug already in use: ${data.slug}`, {
      fieldErrors: { slug: 'Slug sudah dipakai' },
    })
  }

  const insertValues: BattleInsert = {
    ...data,
    status: data.status ?? 'draft',
    createdBy: actorId,
    updatedBy: actorId,
  }

  const [inserted] = await db.insert(battles).values(insertValues).returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert battle')

  await auditLog.write({
    action: 'create',
    resourceType: 'battle',
    resourceId: inserted.id,
    actorId,
    diff: { after: inserted },
  })

  return inserted
}

// ── Update (by slug) ──────────────────────────────────────────────────
export async function update(
  slug: string,
  data: UpdateBattleInput,
  actorId: string,
): Promise<BattleRow> {
  const before = await db.query.battles.findFirst({
    where: and(eq(battles.slug, slug), isNull(battles.deletedAt)),
  })
  if (!before) throw new ApiError('NOT_FOUND', `Battle not found: ${slug}`)

  // If slug changing, enforce uniqueness against other active rows.
  if (data.slug && data.slug !== slug) {
    const clash = await db.query.battles.findFirst({
      where: and(
        eq(battles.slug, data.slug),
        isNull(battles.deletedAt),
        ne(battles.id, before.id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Slug already in use: ${data.slug}`, {
        fieldErrors: { slug: 'Slug sudah dipakai' },
      })
    }
  }

  const [updated] = await db
    .update(battles)
    .set({
      ...data,
      updatedAt: new Date(),
      updatedBy: actorId,
    })
    .where(eq(battles.id, before.id))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to update battle')

  await auditLog.write({
    action: 'update',
    resourceType: 'battle',
    resourceId: updated.id,
    actorId,
    diff: { before, after: updated },
  })

  return updated
}

// ── Soft delete (by slug) — cascade to phases ─────────────────────────
export async function softDelete(slug: string, actorId: string): Promise<void> {
  const row = await db.query.battles.findFirst({
    where: and(eq(battles.slug, slug), isNull(battles.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Battle not found: ${slug}`)

  const now = new Date()

  // Cascade atomically via Neon's HTTP batch (single round-trip, single
  // implicit transaction). Neon-http intentionally does not expose a full
  // `db.transaction` — use `db.batch([...])` instead.
  //
  // Note: battleParticipants / battleLocations are pure join tables with
  // no soft-delete columns; they cascade only on hard-delete (FK CASCADE).
  await db.batch([
    db
      .update(battles)
      .set({ deletedAt: now, deletedBy: actorId, updatedBy: actorId })
      .where(eq(battles.id, row.id)),
    db
      .update(battlePhases)
      .set({ deletedAt: now, deletedBy: actorId })
      .where(and(eq(battlePhases.battleId, row.id), isNull(battlePhases.deletedAt))),
  ])

  await auditLog.write({
    action: 'soft_delete',
    resourceType: 'battle',
    resourceId: row.id,
    actorId,
    diff: { slug: row.slug },
  })
}

// ── Restore (by id) ───────────────────────────────────────────────────
export async function restore(id: string, actorId: string): Promise<BattleRow> {
  const row = await getById(id)
  if (!row.deletedAt) {
    throw new ApiError('CONFLICT', 'Battle is not in trash')
  }

  // If a different active row already owns this slug, refuse.
  const clash = await db.query.battles.findFirst({
    where: and(eq(battles.slug, row.slug), isNull(battles.deletedAt), ne(battles.id, row.id)),
  })
  if (clash) {
    throw new ApiError('CONFLICT', `Cannot restore: slug "${row.slug}" already in use`, {
      fieldErrors: { slug: 'Slug sudah dipakai oleh sirah perang aktif lain' },
    })
  }

  const [restored] = await db
    .update(battles)
    .set({ deletedAt: null, deletedBy: null, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(battles.id, id))
    .returning()
  if (!restored) throw new ApiError('INTERNAL_ERROR', 'Failed to restore battle')

  // Note: dependent battlePhases are NOT auto-restored — admins may want to
  // leave stale rows trashed. Document in BACKEND.md.

  await auditLog.write({
    action: 'restore',
    resourceType: 'battle',
    resourceId: id,
    actorId,
  })

  return restored
}

// ── Hard delete (by id) — must already be in trash ────────────────────
export async function hardDelete(id: string, actorId: string): Promise<void> {
  const row = await getById(id)
  if (!row.deletedAt) {
    throw new ApiError('CONFLICT', 'Battle must be in trash before hard delete')
  }

  // FK `onDelete: 'cascade'` on battlePhases / battleParticipants /
  // battleLocations means the child rows are dropped automatically.
  await db.delete(battles).where(eq(battles.id, id))

  await auditLog.write({
    action: 'hard_delete',
    resourceType: 'battle',
    resourceId: id,
    actorId,
    diff: { slug: row.slug },
  })
}

// ── List trash ────────────────────────────────────────────────────────
export async function listTrash(input: ListTrashQuery): Promise<PaginatedBattles> {
  const { page, perPage } = input
  const offset = (page - 1) * perPage

  const whereExpr = isNotNull(battles.deletedAt)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(battles)
      .where(whereExpr)
      .orderBy(desc(battles.deletedAt))
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(battles).where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

// ── List phases (by battle slug) ──────────────────────────────────────
export async function listPhases(battleSlug: string): Promise<BattlePhaseRow[]> {
  const battle = await db.query.battles.findFirst({
    where: and(eq(battles.slug, battleSlug), isNull(battles.deletedAt)),
    columns: { id: true },
  })
  if (!battle) throw new ApiError('NOT_FOUND', `Battle not found: ${battleSlug}`)

  return db
    .select()
    .from(battlePhases)
    .where(and(eq(battlePhases.battleId, battle.id), isNull(battlePhases.deletedAt)))
    .orderBy(asc(battlePhases.phaseOrder))
}

// ── List participants (by battle slug) — joins figures for names ──────
export async function listParticipants(
  battleSlug: string,
): Promise<ParticipantWithFigure[]> {
  const battle = await db.query.battles.findFirst({
    where: and(eq(battles.slug, battleSlug), isNull(battles.deletedAt)),
    columns: { id: true },
  })
  if (!battle) throw new ApiError('NOT_FOUND', `Battle not found: ${battleSlug}`)

  const rows = await db
    .select({
      battleId: battleParticipants.battleId,
      figureId: battleParticipants.figureId,
      role: battleParticipants.role,
      notesAr: battleParticipants.notesAr,
      notesId: battleParticipants.notesId,
      createdAt: battleParticipants.createdAt,
      figure: {
        id: figures.id,
        slug: figures.slug,
        nameFullAr: figures.nameFullAr,
        nameFullId: figures.nameFullId,
      },
    })
    .from(battleParticipants)
    .leftJoin(figures, eq(figures.id, battleParticipants.figureId))
    .where(eq(battleParticipants.battleId, battle.id))
    .orderBy(asc(battleParticipants.createdAt))

  return rows.map((r) => ({
    battleId: r.battleId,
    figureId: r.figureId,
    role: r.role,
    notesAr: r.notesAr,
    notesId: r.notesId,
    createdAt: r.createdAt,
    figure: r.figure?.id ? r.figure : null,
  }))
}

// ── Add participant (by battle slug + figure id) ──────────────────────
export async function addParticipant(
  battleSlug: string,
  input: AddParticipantInput,
  actorId: string,
): Promise<BattleParticipantRow> {
  const battle = await db.query.battles.findFirst({
    where: and(eq(battles.slug, battleSlug), isNull(battles.deletedAt)),
    columns: { id: true },
  })
  if (!battle) throw new ApiError('NOT_FOUND', `Battle not found: ${battleSlug}`)

  // Confirm figure exists + is active.
  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.id, input.figureId), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!figure) throw new ApiError('NOT_FOUND', `Figure not found: ${input.figureId}`)

  // Refuse duplicates (composite PK would 23505 anyway — but a clean 409
  // is friendlier).
  const existing = await db.query.battleParticipants.findFirst({
    where: and(
      eq(battleParticipants.battleId, battle.id),
      eq(battleParticipants.figureId, input.figureId),
    ),
  })
  if (existing) {
    throw new ApiError('CONFLICT', 'Figure is already a participant of this battle')
  }

  const [inserted] = await db
    .insert(battleParticipants)
    .values({
      battleId: battle.id,
      figureId: input.figureId,
      role: input.role,
      notesAr: input.notesAr ?? null,
      notesId: input.notesId ?? null,
    })
    .returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert participant')

  await auditLog.write({
    action: 'create',
    resourceType: 'battle_participant',
    resourceId: battle.id,
    actorId,
    diff: { after: inserted },
  })

  return inserted
}

// ── Default export (namespaced) ───────────────────────────────────────
export const battleService = {
  list,
  getBySlug,
  create,
  update,
  softDelete,
  restore,
  hardDelete,
  listTrash,
  listPhases,
  listParticipants,
  addParticipant,
}
