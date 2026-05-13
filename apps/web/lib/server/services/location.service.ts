// Location service — public list (for map) + admin CRUD.
// The `coordinates` column is PostGIS GEOGRAPHY(POINT, 4326).  We store it
// via WKT (`POINT(lng lat)`) and read it back as GeoJSON Point so the map
// client can consume it directly.  See DATABASE.md §5 + post-migrate.ts.

import { and, asc, eq, ilike, isNull, ne, or, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { locations } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { auditLog } from './audit.service.js'

export type LocationRow = typeof locations.$inferSelect
type LocationInsert = typeof locations.$inferInsert

/** GeoJSON Point shape returned to the public map client. */
export interface GeoJsonPoint {
  type: 'Point'
  coordinates: [number, number] // [lng, lat]
}

/** Public list row — replaces the WKT string with a GeoJSON object. */
export interface PublicLocation extends Omit<LocationRow, 'coordinates'> {
  coordinates: GeoJsonPoint | null
}

export interface ListPublicLocationsQuery {
  q?: string
  region?: string
  countryCode?: string
}

export interface CreateLocationInput {
  slug: string
  nameAr: string
  nameId: string
  lat: number
  lng: number
  modernName?: string | null
  region?: string | null
  countryCode?: string | null
  elevationMeters?: number | null
  descriptionAr?: string | null
  descriptionId?: string | null
  historicalPeriod?: string[] | null
}

export interface UpdateLocationInput {
  slug?: string
  nameAr?: string
  nameId?: string
  lat?: number
  lng?: number
  modernName?: string | null
  region?: string | null
  countryCode?: string | null
  elevationMeters?: number | null
  descriptionAr?: string | null
  descriptionId?: string | null
  historicalPeriod?: string[] | null
}

// ── Public list (for the map) ────────────────────────────────────────
/**
 * Public list — every active location with coordinates projected to a
 * GeoJSON Point.  Supports free-text filter (name/slug ILIKE), region, and
 * country code.  No pagination: the map wants the whole layer at once.
 */
export async function listPublic(
  query: ListPublicLocationsQuery = {},
): Promise<PublicLocation[]> {
  const { q, region, countryCode } = query

  const where = [isNull(locations.deletedAt)]
  if (region) where.push(eq(locations.region, region))
  if (countryCode) where.push(eq(locations.countryCode, countryCode))
  if (q) {
    const like = `%${q}%`
    where.push(
      or(
        ilike(locations.nameAr, like),
        ilike(locations.nameId, like),
        ilike(locations.modernName, like),
        ilike(locations.slug, like),
      )!,
    )
  }

  // ST_AsGeoJSON returns the full GeoJSON Point as text — cast to jsonb so
  // Postgres returns it as a parsed object to the driver.  NULL coordinates
  // (legacy rows) come back as null.
  const rows = await db
    .select({
      id: locations.id,
      createdAt: locations.createdAt,
      updatedAt: locations.updatedAt,
      createdBy: locations.createdBy,
      updatedBy: locations.updatedBy,
      deletedAt: locations.deletedAt,
      deletedBy: locations.deletedBy,
      slug: locations.slug,
      nameAr: locations.nameAr,
      nameId: locations.nameId,
      modernName: locations.modernName,
      countryCode: locations.countryCode,
      region: locations.region,
      elevationMeters: locations.elevationMeters,
      descriptionAr: locations.descriptionAr,
      descriptionId: locations.descriptionId,
      historicalPeriod: locations.historicalPeriod,
      coordinates: sql<GeoJsonPoint | null>`
        CASE
          WHEN ${locations.coordinates} IS NULL THEN NULL
          ELSE ST_AsGeoJSON(${locations.coordinates}::geography)::jsonb
        END
      `,
    })
    .from(locations)
    .where(and(...where))
    .orderBy(asc(locations.nameId))

  return rows as PublicLocation[]
}

// ── Admin helpers ────────────────────────────────────────────────────
async function getById(id: string): Promise<LocationRow> {
  const row = await db.query.locations.findFirst({ where: eq(locations.id, id) })
  if (!row) throw new ApiError('NOT_FOUND', `Location not found: ${id}`)
  return row
}

/**
 * Build a WKT POINT literal from lng/lat.  PostGIS accepts WKT directly via
 * an implicit cast on a `geography` column.
 */
function wktPoint(lng: number, lat: number): string {
  // Validate so callers get a friendly error rather than a Postgres parse error.
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new ApiError('VALIDATION_ERROR', 'Koordinat tidak valid', {
      fieldErrors: { lat: 'Wajib angka', lng: 'Wajib angka' },
    })
  }
  if (lng < -180 || lng > 180) {
    throw new ApiError('VALIDATION_ERROR', 'lng harus -180..180', {
      fieldErrors: { lng: 'Harus -180..180' },
    })
  }
  if (lat < -90 || lat > 90) {
    throw new ApiError('VALIDATION_ERROR', 'lat harus -90..90', {
      fieldErrors: { lat: 'Harus -90..90' },
    })
  }
  return `POINT(${lng} ${lat})`
}

/**
 * Create a location.  Slug must be unique among active rows.  Coordinates
 * are persisted as WKT — the GEOGRAPHY column casts implicitly.
 */
export async function create(
  input: CreateLocationInput,
  actorId: string | null,
): Promise<LocationRow> {
  const existing = await db.query.locations.findFirst({
    where: and(eq(locations.slug, input.slug), isNull(locations.deletedAt)),
  })
  if (existing) {
    throw new ApiError('CONFLICT', `Slug already in use: ${input.slug}`, {
      fieldErrors: { slug: 'Slug sudah dipakai' },
    })
  }

  const wkt = wktPoint(input.lng, input.lat)

  const values: LocationInsert = {
    slug: input.slug,
    nameAr: input.nameAr,
    nameId: input.nameId,
    modernName: input.modernName ?? null,
    countryCode: input.countryCode ?? null,
    region: input.region ?? null,
    elevationMeters: input.elevationMeters ?? null,
    descriptionAr: input.descriptionAr ?? null,
    descriptionId: input.descriptionId ?? null,
    historicalPeriod: input.historicalPeriod ?? null,
    // Drizzle declared `coordinates` as text — pass WKT, PostGIS casts it.
    coordinates: wkt,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  }

  const [inserted] = await db.insert(locations).values(values).returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert location')

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'location',
    resourceId: inserted.id,
    diff: { after: inserted },
  })

  return inserted
}

/**
 * Update mutable fields.  When `lat`/`lng` are supplied (both required —
 * coordinates always travel as a pair) we rewrite the WKT point.
 */
export async function update(
  id: string,
  input: UpdateLocationInput,
  actorId: string | null,
): Promise<LocationRow> {
  const before = await getById(id)

  if (input.slug !== undefined && input.slug !== before.slug) {
    const clash = await db.query.locations.findFirst({
      where: and(
        eq(locations.slug, input.slug),
        isNull(locations.deletedAt),
        ne(locations.id, id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Slug already in use: ${input.slug}`, {
        fieldErrors: { slug: 'Slug sudah dipakai' },
      })
    }
  }

  const patch: Partial<LocationInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.slug !== undefined) patch.slug = input.slug
  if (input.nameAr !== undefined) patch.nameAr = input.nameAr
  if (input.nameId !== undefined) patch.nameId = input.nameId
  if (input.modernName !== undefined) patch.modernName = input.modernName
  if (input.region !== undefined) patch.region = input.region
  if (input.countryCode !== undefined) patch.countryCode = input.countryCode
  if (input.elevationMeters !== undefined) patch.elevationMeters = input.elevationMeters
  if (input.descriptionAr !== undefined) patch.descriptionAr = input.descriptionAr
  if (input.descriptionId !== undefined) patch.descriptionId = input.descriptionId
  if (input.historicalPeriod !== undefined) patch.historicalPeriod = input.historicalPeriod

  if (input.lat !== undefined || input.lng !== undefined) {
    if (input.lat === undefined || input.lng === undefined) {
      throw new ApiError('VALIDATION_ERROR', 'lat dan lng harus dikirim bersamaan', {
        fieldErrors: {
          lat: input.lat === undefined ? 'Wajib bila lng diubah' : '',
          lng: input.lng === undefined ? 'Wajib bila lat diubah' : '',
        },
      })
    }
    patch.coordinates = wktPoint(input.lng, input.lat)
  }

  const [updated] = await db
    .update(locations)
    .set(patch)
    .where(eq(locations.id, id))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to update location')

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'location',
    resourceId: id,
    diff: { before, after: updated },
  })

  return updated
}

/**
 * Soft-delete a location.  No cascade — `figureLocations` rows just point
 * at a soft-deleted parent and the joiner can decide whether to surface them.
 */
export async function softDelete(id: string, actorId: string | null): Promise<void> {
  const row = await getById(id)
  if (row.deletedAt) {
    throw new ApiError('CONFLICT', 'Location already deleted')
  }

  const now = new Date()
  await db
    .update(locations)
    .set({
      deletedAt: now,
      deletedBy: actorId ?? null,
      updatedAt: now,
      updatedBy: actorId ?? null,
    })
    .where(eq(locations.id, id))

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'location',
    resourceId: id,
    diff: { slug: row.slug },
  })
}

export const locationService = {
  listPublic,
  create,
  update,
  softDelete,
}
