// Figure service — business logic for the `figures` resource.
// All CRUD + soft-delete + trash flows live here.  Route handlers should
// NEVER touch Drizzle directly for this table.
//
// See docs/BACKEND.md §1 (No raw CRUD), §4 (Soft Delete), §11 (Audit).

import { and, asc, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import {
  battleParticipants,
  battles,
  citations,
  figures,
  figureCategories,
  figureLocations,
  figureRelationPaths,
  figureRelations,
  locations,
  whitelistDomains,
} from '@athar/db/schema'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'
import { filterAllowedFigureIds } from '@/lib/server/services/content-access.service'
import type {
  CreateFigureInput,
  ListFiguresQuery,
  ListTrashQuery,
  UpdateFigureInput,
} from './figure.schemas.js'

// ── Types ─────────────────────────────────────────────────────────────
type FigureRow = typeof figures.$inferSelect
type FigureInsert = typeof figures.$inferInsert

/** GeoJSON Point as returned by ST_AsGeoJSON. */
export interface FigureGeoJsonPoint {
  type: 'Point'
  coordinates: [number, number]
}

/** A `figure_locations` row enriched with its joined `locations` row. */
export interface EnrichedFigureLocation {
  id: string
  role: (typeof figureLocations.$inferSelect)['role']
  periodStartAh: number | null
  periodEndAh: number | null
  notesAr: string | null
  notesId: string | null
  location: {
    id: string
    slug: string
    nameId: string
    nameAr: string
    modernName: string | null
    countryCode: string | null
    region: string | null
    coordinates: FigureGeoJsonPoint | null
  }
}

/** A `figure_relations` row enriched with the related figure's summary. */
export interface EnrichedFigureRelation {
  id: string
  relationType: (typeof figureRelations.$inferSelect)['relationType']
  notesAr: string | null
  notesId: string | null
  related: {
    id: string
    slug: string
    gender: 'male' | 'female'
    nameFullId: string
    nameFullAr: string
    nameShortId: string | null
    nameShortAr: string | null
  }
}

/** A battle the figure participated in — for timeline rendering. */
export interface FigureTimelineBattle {
  battleId: string
  slug: string
  nameId: string
  nameAr: string
  eventDateAh: number | null
  eventDateCe: number | null
  role: (typeof battleParticipants.$inferSelect)['role']
}

/** Aggregated timeline payload for the figure detail page. */
export interface FigureTimeline {
  birthAh: number | null
  birthCe: number | null
  deathAh: number | null
  deathCe: number | null
  battles: FigureTimelineBattle[]
}

/** A citation row enriched with its whitelist domain display name. */
export interface EnrichedCitation {
  id: string
  sourceUrl: string
  sourceDomain: string | null
  sourceLang: 'ar' | 'id' | 'en' | null
  sourceExcerptAr: string | null
  sourceExcerptId: string | null
  fieldPath: string | null
  confidenceScore: string | null
  createdAt: Date
  extractedAt: Date | null
  domain: {
    displayName: string | null
    priority: number | null
  } | null
}

export interface FigureWithRelations extends FigureRow {
  category: typeof figureCategories.$inferSelect | null
  /** Relations where this figure is the SOURCE (`figureId = this.id`). */
  relations: EnrichedFigureRelation[]
  /** `figure_locations` with the joined location row populated. */
  locations: EnrichedFigureLocation[]
  /** Birth, death, and battles plotted on the per-figure timeline. */
  timelineEvents: FigureTimeline
  /** Citations attached to this figure (`contentType = 'figure'`). */
  citations: EnrichedCitation[]
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
// The figure detail page renders 6 tabs (Biografi / Timeline / Peta /
// Hubungan / Hadits / Sumber). We fold ALL the data each tab needs into
// this single call so the page is one HTTP round-trip instead of five.
// All sub-queries run in parallel; the SELECT projections stay narrow so
// we don't ship the kitchen sink to the client.
export async function getBySlug(slug: string): Promise<FigureWithRelations> {
  const row = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const [
    category,
    relationRows,
    locationRows,
    battleRows,
    citationRows,
  ] = await Promise.all([
    db.query.figureCategories.findFirst({
      where: eq(figureCategories.id, row.categoryId),
    }),

    // Relations — only those where THIS figure is the source. Seeds insert
    // both directions, so we don't need to also look up the reverse.
    db
      .select({
        id: figureRelations.id,
        relationType: figureRelations.relationType,
        notesAr: figureRelations.notesAr,
        notesId: figureRelations.notesId,
        relatedId: figures.id,
        relatedSlug: figures.slug,
        relatedGender: figures.gender,
        relatedNameFullId: figures.nameFullId,
        relatedNameFullAr: figures.nameFullAr,
        relatedNameShortId: figures.nameShortId,
        relatedNameShortAr: figures.nameShortAr,
      })
      .from(figureRelations)
      .innerJoin(figures, eq(figureRelations.relatedId, figures.id))
      .where(
        and(
          eq(figureRelations.figureId, row.id),
          isNull(figureRelations.deletedAt),
          isNull(figures.deletedAt),
        ),
      )
      .orderBy(asc(figures.nameFullId))
      .limit(200),

    // Locations — JOIN locations and project coordinates as GeoJSON so the
    // map tab can render markers without a second round-trip.
    db
      .select({
        id: figureLocations.id,
        role: figureLocations.role,
        periodStartAh: figureLocations.periodStartAh,
        periodEndAh: figureLocations.periodEndAh,
        notesAr: figureLocations.notesAr,
        notesId: figureLocations.notesId,
        locId: locations.id,
        locSlug: locations.slug,
        locNameId: locations.nameId,
        locNameAr: locations.nameAr,
        locModernName: locations.modernName,
        locCountryCode: locations.countryCode,
        locRegion: locations.region,
        locCoordinates: sql<FigureGeoJsonPoint | null>`
          CASE
            WHEN ${locations.coordinates} IS NULL THEN NULL
            ELSE ST_AsGeoJSON(${locations.coordinates}::geography)::jsonb
          END
        `,
      })
      .from(figureLocations)
      .innerJoin(locations, eq(figureLocations.locationId, locations.id))
      .where(
        and(
          eq(figureLocations.figureId, row.id),
          isNull(figureLocations.deletedAt),
          isNull(locations.deletedAt),
        ),
      )
      .orderBy(asc(figureLocations.periodStartAh)),

    // Battles the figure participated in — for the Timeline tab.
    db
      .select({
        battleId: battles.id,
        slug: battles.slug,
        nameId: battles.nameId,
        nameAr: battles.nameAr,
        eventDateAh: battles.eventDateAh,
        eventDateCe: battles.eventDateCe,
        role: battleParticipants.role,
      })
      .from(battleParticipants)
      .innerJoin(battles, eq(battleParticipants.battleId, battles.id))
      .where(
        and(
          eq(battleParticipants.figureId, row.id),
          isNull(battles.deletedAt),
        ),
      )
      .orderBy(asc(battles.eventDateAh)),

    // Citations — LEFT JOIN whitelist so unknown domains still surface.
    db
      .select({
        id: citations.id,
        sourceUrl: citations.sourceUrl,
        sourceDomain: citations.sourceDomain,
        sourceLang: citations.sourceLang,
        sourceExcerptAr: citations.sourceExcerptAr,
        sourceExcerptId: citations.sourceExcerptId,
        fieldPath: citations.fieldPath,
        confidenceScore: citations.confidenceScore,
        createdAt: citations.createdAt,
        extractedAt: citations.extractedAt,
        domainDisplayName: whitelistDomains.displayName,
        domainPriority: whitelistDomains.priority,
      })
      .from(citations)
      .leftJoin(whitelistDomains, eq(citations.sourceDomain, whitelistDomains.domain))
      .where(
        and(
          eq(citations.contentType, 'figure'),
          eq(citations.contentId, row.id),
          isNull(citations.deletedAt),
        ),
      )
      .orderBy(desc(whitelistDomains.priority), asc(citations.createdAt)),
  ])

  // Reshape relations into the public-facing nested shape.
  const relations: EnrichedFigureRelation[] = relationRows.map((r) => ({
    id: r.id,
    relationType: r.relationType,
    notesAr: r.notesAr,
    notesId: r.notesId,
    related: {
      id: r.relatedId,
      slug: r.relatedSlug,
      gender: r.relatedGender,
      nameFullId: r.relatedNameFullId,
      nameFullAr: r.relatedNameFullAr,
      nameShortId: r.relatedNameShortId,
      nameShortAr: r.relatedNameShortAr,
    },
  }))

  // Reshape locations.
  const locs: EnrichedFigureLocation[] = locationRows.map((l) => ({
    id: l.id,
    role: l.role,
    periodStartAh: l.periodStartAh,
    periodEndAh: l.periodEndAh,
    notesAr: l.notesAr,
    notesId: l.notesId,
    location: {
      id: l.locId,
      slug: l.locSlug,
      nameId: l.locNameId,
      nameAr: l.locNameAr,
      modernName: l.locModernName,
      countryCode: l.locCountryCode,
      region: l.locRegion,
      coordinates: l.locCoordinates,
    },
  }))

  // Splice direct FKs (primary/death/burial location) into the location list
  // as synthetic entries if they're not already covered by `figure_locations`.
  // This is the data that lives on the `figures` row itself (DATABASE.md §4).
  const directLocationIds: { id: string; role: 'birthplace' | 'martyr' | 'burial' }[] = []
  if (row.primaryLocationId)
    directLocationIds.push({ id: row.primaryLocationId, role: 'birthplace' })
  if (row.deathLocationId)
    directLocationIds.push({ id: row.deathLocationId, role: 'martyr' })
  if (row.burialLocationId)
    directLocationIds.push({ id: row.burialLocationId, role: 'burial' })

  const seenLocPairs = new Set(locs.map((l) => `${l.location.id}:${l.role}`))
  const missingIds = directLocationIds
    .filter((d) => !seenLocPairs.has(`${d.id}:${d.role}`))
    .map((d) => d.id)

  if (missingIds.length > 0) {
    const extras = await db
      .select({
        id: locations.id,
        slug: locations.slug,
        nameId: locations.nameId,
        nameAr: locations.nameAr,
        modernName: locations.modernName,
        countryCode: locations.countryCode,
        region: locations.region,
        coordinates: sql<FigureGeoJsonPoint | null>`
          CASE
            WHEN ${locations.coordinates} IS NULL THEN NULL
            ELSE ST_AsGeoJSON(${locations.coordinates}::geography)::jsonb
          END
        `,
      })
      .from(locations)
      .where(and(inArray(locations.id, missingIds), isNull(locations.deletedAt)))

    const byId = new Map(extras.map((e) => [e.id, e]))
    for (const d of directLocationIds) {
      const key = `${d.id}:${d.role}`
      if (seenLocPairs.has(key)) continue
      const loc = byId.get(d.id)
      if (!loc) continue
      seenLocPairs.add(key)
      locs.push({
        id: `direct:${d.role}:${d.id}`,
        role: d.role,
        periodStartAh: null,
        periodEndAh: null,
        notesAr: null,
        notesId: null,
        location: loc,
      })
    }
  }

  // Citations reshape.
  const citationsList: EnrichedCitation[] = citationRows.map((c) => ({
    id: c.id,
    sourceUrl: c.sourceUrl,
    sourceDomain: c.sourceDomain,
    sourceLang: c.sourceLang,
    sourceExcerptAr: c.sourceExcerptAr,
    sourceExcerptId: c.sourceExcerptId,
    fieldPath: c.fieldPath,
    confidenceScore: c.confidenceScore != null ? String(c.confidenceScore) : null,
    createdAt: c.createdAt,
    extractedAt: c.extractedAt,
    domain: c.domainDisplayName || c.domainPriority != null
      ? { displayName: c.domainDisplayName, priority: c.domainPriority }
      : null,
  }))

  const timelineEvents: FigureTimeline = {
    birthAh: row.birthDateAh,
    birthCe: row.birthDateCe,
    deathAh: row.deathDateAh,
    deathCe: row.deathDateCe,
    battles: battleRows.map((b) => ({
      battleId: b.battleId,
      slug: b.slug,
      nameId: b.nameId,
      nameAr: b.nameAr,
      eventDateAh: b.eventDateAh,
      eventDateCe: b.eventDateCe,
      role: b.role,
    })),
  }

  return {
    ...row,
    category: category ?? null,
    relations,
    locations: locs,
    timelineEvents,
    citations: citationsList,
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
  //
  // Also invalidate every `figure_relation_paths` cache row touching this
  // figure (either direction) so the next /api/v1/figures/relation lookup
  // re-computes from scratch instead of returning a stale entry that may
  // reference soft-deleted data.
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
    db
      .update(figureRelationPaths)
      .set({ deletedAt: now, deletedBy: actorId })
      .where(
        and(
          or(
            eq(figureRelationPaths.fromFigureId, row.id),
            eq(figureRelationPaths.toFigureId, row.id),
          ),
          isNull(figureRelationPaths.deletedAt),
        ),
      ),
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

// ── Map points (figure overlay on /map) ───────────────────────────────
//
// One row per PUBLISHED figure that resolves to at least one location.
// "Resolved" follows a preference cascade so every tokoh appears even if
// only the death/burial side is filled in:
//   1. `figures.primaryLocationId`
//   2. `figures.deathLocationId`
//   3. `figures.burialLocationId`
//   4. First `figure_locations` row (any role) with a non-null `locationId`.
//
// COALESCE handles the first three FK columns inline.  The 4th fallback
// is layered as a UNION-style second pass — figures with none of the
// direct FKs but at least one `figure_locations` row.  PostGIS
// `ST_X` / `ST_Y` on the geography-cast geometry extracts lng/lat.
//
// Content scope is applied AFTER the DB pass via `filterAllowedFigureIds`
// (same pattern as the AI chat tool) so anonymous/free-tier callers only
// see figures their plan covers.  Staff (admin/reviewer) bypass.

export type FigureLocationRole = (typeof figureLocations.$inferSelect)['role']

export interface FigureMapPoint {
  figureId: string
  slug: string
  nameFullId: string
  nameFullAr: string
  nameShortId: string | null
  gender: 'male' | 'female'
  categorySlug: string | null
  locationId: string
  locationSlug: string | null
  locationName: string
  longitude: number
  latitude: number
  /** Which preference-tier the location was resolved from. */
  role: 'primary' | 'death' | 'burial' | 'figure_location'
}

export async function listMapPoints(
  userId: string | null,
): Promise<FigureMapPoint[]> {
  // Pass 1 — figures whose `primary | death | burial` FK resolves to a
  // location with coordinates.  COALESCE picks the first non-null FK and
  // we LEFT JOIN locations once on the resolved id.
  const resolvedId = sql<string>`COALESCE(${figures.primaryLocationId}, ${figures.deathLocationId}, ${figures.burialLocationId})`

  const directRows = await db
    .select({
      figureId: figures.id,
      slug: figures.slug,
      nameFullId: figures.nameFullId,
      nameFullAr: figures.nameFullAr,
      nameShortId: figures.nameShortId,
      gender: figures.gender,
      categorySlug: figureCategories.slug,
      // Resolved FK ids for role classification.
      primaryLocationId: figures.primaryLocationId,
      deathLocationId: figures.deathLocationId,
      burialLocationId: figures.burialLocationId,
      locationId: locations.id,
      locationSlug: locations.slug,
      locationNameId: locations.nameId,
      // PostGIS extraction — cast the geography to geometry first so ST_X/ST_Y
      // accept it without a srid mismatch.
      longitude: sql<number>`ST_X(${locations.coordinates}::geometry)`,
      latitude: sql<number>`ST_Y(${locations.coordinates}::geometry)`,
    })
    .from(figures)
    .leftJoin(locations, eq(locations.id, resolvedId))
    .leftJoin(figureCategories, eq(figureCategories.id, figures.categoryId))
    .where(
      and(
        isNull(figures.deletedAt),
        isNull(figureCategories.deletedAt),
        isNull(locations.deletedAt),
        isNotNull(locations.coordinates),
        sql`${figures.status} = 'published'`,
      ),
    )

  // Pass 2 — figures with NO direct FK but at least one figure_locations
  // row.  We pick the earliest row (by created_at ascending) as the
  // canonical "first row" per the brief's fallback order.
  const fallbackRows = await db
    .select({
      figureId: figures.id,
      slug: figures.slug,
      nameFullId: figures.nameFullId,
      nameFullAr: figures.nameFullAr,
      nameShortId: figures.nameShortId,
      gender: figures.gender,
      categorySlug: figureCategories.slug,
      figureLocationCreatedAt: figureLocations.createdAt,
      locationId: locations.id,
      locationSlug: locations.slug,
      locationNameId: locations.nameId,
      longitude: sql<number>`ST_X(${locations.coordinates}::geometry)`,
      latitude: sql<number>`ST_Y(${locations.coordinates}::geometry)`,
    })
    .from(figures)
    .innerJoin(figureLocations, eq(figureLocations.figureId, figures.id))
    .innerJoin(locations, eq(locations.id, figureLocations.locationId))
    .leftJoin(figureCategories, eq(figureCategories.id, figures.categoryId))
    .where(
      and(
        isNull(figures.deletedAt),
        isNull(figureLocations.deletedAt),
        isNull(locations.deletedAt),
        isNull(figureCategories.deletedAt),
        isNotNull(locations.coordinates),
        sql`${figures.status} = 'published'`,
        isNull(figures.primaryLocationId),
        isNull(figures.deathLocationId),
        isNull(figures.burialLocationId),
      ),
    )
    .orderBy(asc(figureLocations.createdAt))

  // Build a map<figureId, point> — direct rows win, fallback fills the gaps.
  const byId = new Map<string, FigureMapPoint>()

  for (const r of directRows) {
    if (!r.locationId || r.longitude == null || r.latitude == null) continue
    // Classify which FK actually resolved.  We rely on the same preference
    // order as the COALESCE so the role label matches reality.
    let role: FigureMapPoint['role']
    if (r.primaryLocationId === r.locationId) role = 'primary'
    else if (r.deathLocationId === r.locationId) role = 'death'
    else if (r.burialLocationId === r.locationId) role = 'burial'
    else role = 'primary' // defensive — shouldn't happen given the COALESCE

    byId.set(r.figureId, {
      figureId: r.figureId,
      slug: r.slug,
      nameFullId: r.nameFullId,
      nameFullAr: r.nameFullAr,
      nameShortId: r.nameShortId,
      gender: r.gender,
      categorySlug: r.categorySlug ?? null,
      locationId: r.locationId,
      locationSlug: r.locationSlug ?? null,
      // `leftJoin` makes nameId nullable in TS even though the WHERE clause
      // filters out locations without coordinates (which implies the row exists).
      locationName: r.locationNameId ?? '',
      longitude: Number(r.longitude),
      latitude: Number(r.latitude),
      role,
    })
  }

  for (const r of fallbackRows) {
    if (byId.has(r.figureId)) continue // direct FK already covered
    if (!r.locationId || r.longitude == null || r.latitude == null) continue
    byId.set(r.figureId, {
      figureId: r.figureId,
      slug: r.slug,
      nameFullId: r.nameFullId,
      nameFullAr: r.nameFullAr,
      nameShortId: r.nameShortId,
      gender: r.gender,
      categorySlug: r.categorySlug ?? null,
      locationId: r.locationId,
      locationSlug: r.locationSlug ?? null,
      locationName: r.locationNameId,
      longitude: Number(r.longitude),
      latitude: Number(r.latitude),
      role: 'figure_location',
    })
  }

  const allPoints = Array.from(byId.values())
  if (allPoints.length === 0) return []

  // Content scope — staff bypass returns the full id list.  Anonymous /
  // free callers get only the figures their tier covers (nabi +
  // shalih_pre_rasul + curated allow-list).
  const allowedIds = await filterAllowedFigureIds(
    userId,
    allPoints.map((p) => p.figureId),
  )
  const allowed = new Set(allowedIds)
  return allPoints.filter((p) => allowed.has(p.figureId))
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
  listMapPoints,
}
