// Locations schema. Note: `coordinates` is declared as text in Drizzle to
// avoid generator quoting issues with `geography(point, 4326)`. The actual
// column type is altered to PostGIS GEOGRAPHY in src/post-migrate.ts.
// See DATABASE.md §5.

import { sql } from 'drizzle-orm'
import { pgTable, uuid, text, integer, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'

// ─── locations ─────────────────────────────────────────────────────
export const locations = pgTable(
  'locations',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameId: text('name_id').notNull(),
    modernName: text('modern_name'),
    countryCode: text('country_code'),
    region: text('region'), // 'hijaz' | 'iraq' | 'sham' | 'misr' | dll
    // PostGIS GEOGRAPHY(POINT, 4326) — altered post-migration.
    // Stored as WKT string: 'POINT(lng lat)'. Query via ST_GeomFromText/ST_DWithin.
    coordinates: text('coordinates'),
    elevationMeters: integer('elevation_meters'),
    descriptionAr: text('description_ar'),
    descriptionId: text('description_id'),
    historicalPeriod: text('historical_period').array(),
  },
  (t) => [
    uniqueIndex('locations_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('locations_region_idx').on(t.region),
  ],
)

// ─── location_aliases ──────────────────────────────────────────────
export const locationAliases = pgTable(
  'location_aliases',
  {
    ...baseColumns,
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    aliasAr: text('alias_ar'),
    aliasId: text('alias_id'),
    aliasEn: text('alias_en'),
    notes: text('notes'),
  },
  (t) => [index('location_aliases_loc_idx').on(t.locationId)],
)
