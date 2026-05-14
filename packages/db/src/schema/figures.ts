// Figures (core content) schema. See DATABASE.md §4.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  index,
  uniqueIndex,
  timestamp,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import {
  genderEnum,
  socialCategoryEnum,
  madhabEnum,
  rijalGradeEnum,
  deathStatusEnum,
  deathCauseEnum,
  contentStatusEnum,
  datePrecisionEnum,
  figureRelationTypeEnum,
  figureLocationRoleEnum,
} from './enums.js'
import { locations } from './locations.js'

// ─── figure_categories ─────────────────────────────────────────────
export const figureCategories = pgTable(
  'figure_categories',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    nameId: text('name_id').notNull(),
    nameAr: text('name_ar'),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('figure_categories_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── figures ───────────────────────────────────────────────────────
export const figures = pgTable(
  'figures',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => figureCategories.id),
    gender: genderEnum('gender').notNull(),

    nameFullAr: text('name_full_ar').notNull(),
    nameFullId: text('name_full_id').notNull(),
    nameShortAr: text('name_short_ar'),
    nameShortId: text('name_short_id'),
    kunyahAr: text('kunyah_ar'),
    kunyahId: text('kunyah_id'),
    laqabAr: text('laqab_ar'),
    laqabId: text('laqab_id'),

    // Birth dates (dual calendar)
    birthDateAh: integer('birth_date_ah'),
    birthDateCe: integer('birth_date_ce'),
    birthDateAhFull: date('birth_date_ah_full'),
    birthDateCeFull: date('birth_date_ce_full'),
    birthDatePrecision: datePrecisionEnum('birth_date_precision'),
    birthDateNotes: text('birth_date_notes'),

    // Death dates (dual calendar)
    deathDateAh: integer('death_date_ah'),
    deathDateCe: integer('death_date_ce'),
    deathDateAhFull: date('death_date_ah_full'),
    deathDateCeFull: date('death_date_ce_full'),
    deathDatePrecision: datePrecisionEnum('death_date_precision'),
    deathDateNotes: text('death_date_notes'),

    deathStatus: deathStatusEnum('death_status').notNull().default('died'),
    deathCause: deathCauseEnum('death_cause'),

    socialCategory: socialCategoryEnum('social_category').array(),
    specialty: text('specialty').array(),
    madhab: madhabEnum('madhab'),

    rijalGrade: rijalGradeEnum('rijal_grade').default('unverified').notNull(),
    rijalNotesAr: text('rijal_notes_ar'),
    rijalNotesId: text('rijal_notes_id'),

    hadithCountMin: integer('hadith_count_min'),
    hadithCountMax: integer('hadith_count_max'),

    summaryAr: text('summary_ar'),
    summaryId: text('summary_id'),
    biographyAr: text('biography_ar'),
    biographyId: text('biography_id'),
    biographyPreWafatAr: text('biography_pre_wafat_ar'),
    biographyPreWafatId: text('biography_pre_wafat_id'),
    biographyPostWafatAr: text('biography_post_wafat_ar'),
    biographyPostWafatId: text('biography_post_wafat_id'),

    primaryLocationId: uuid('primary_location_id').references(() => locations.id),
    deathLocationId: uuid('death_location_id').references(() => locations.id),
    burialLocationId: uuid('burial_location_id').references(() => locations.id),

    status: contentStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('figures_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('figures_category_gender_idx')
      .on(t.categoryId, t.gender)
      .where(sql`${t.deletedAt} IS NULL`),
    index('figures_death_ah_idx').on(t.deathDateAh).where(sql`${t.deletedAt} IS NULL`),
    index('figures_birth_ah_idx').on(t.birthDateAh).where(sql`${t.deletedAt} IS NULL`),
    index('figures_status_idx').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── figure_relations ──────────────────────────────────────────────
export const figureRelations = pgTable(
  'figure_relations',
  {
    ...baseColumns,
    figureId: uuid('figure_id')
      .notNull()
      .references(() => figures.id, { onDelete: 'cascade' }),
    relatedId: uuid('related_id')
      .notNull()
      .references(() => figures.id, { onDelete: 'cascade' }),
    relationType: figureRelationTypeEnum('relation_type').notNull(),
    notesAr: text('notes_ar'),
    notesId: text('notes_id'),
  },
  (t) => [
    uniqueIndex('figure_relations_unique_idx')
      .on(t.figureId, t.relatedId, t.relationType)
      .where(sql`${t.deletedAt} IS NULL`),
    index('figure_relations_figure_idx').on(t.figureId),
    index('figure_relations_related_idx').on(t.relatedId),
  ],
)

// ─── figure_relation_paths ──────────────────────────────────────────
// Cached "relation checker" results. Each row records the resolved
// relationship between a directed pair of figures (from → to), along with
// the human-readable Indonesian/Arabic explanation, the ordered path of
// edges that produced it, and where the answer came from (DB graph walk,
// AI + websearch, or an explicit "no relation found").
//
// Invalidation contract:
//   - When admin edits a `figure_relations` row touching either party,
//     all rows in this table referencing that figure should be soft-deleted
//     (`deleted_at = now()`) so the next lookup re-computes from scratch.
//   - Otherwise we honour a 30-day TTL at the API layer — anything older
//     than that is treated as stale and re-resolved.
//
// `path_json` shape: `RelationPathStep[]` — each step is one hop in the
// resolved chain. For AI-fallback rows the path is best-effort (often empty).

export interface RelationPathStep {
  /** Figure UUID for this hop. Null when the AI fallback couldn't resolve a real figure. */
  figureId: string | null
  /** Stable slug for linking — null when figureId is null. */
  slug: string | null
  /** Display name shown in the breadcrumb. */
  name: string
  /** Relation type slug (`father`, `companion`, `teacher_of`, …) used to reach this hop. Empty on the seed step. */
  edgeType: string
  /** Human label rendered between hops, e.g. "anak dari", "guru dari". */
  edgeLabel: string
}

export const figureRelationPaths = pgTable(
  'figure_relation_paths',
  {
    ...baseColumns,
    fromFigureId: uuid('from_figure_id')
      .notNull()
      .references(() => figures.id, { onDelete: 'cascade' }),
    toFigureId: uuid('to_figure_id')
      .notNull()
      .references(() => figures.id, { onDelete: 'cascade' }),
    /**
     * - `db_graph`     — pure graph traversal succeeded.
     * - `ai_websearch` — AI fallback used the salafi whitelist to extract a relationship.
     * - `none`         — explicitly "no relationship found" (cached so we don't keep asking AI).
     */
    resolutionSource: text('resolution_source', {
      enum: ['db_graph', 'ai_websearch', 'none'],
    }).notNull(),
    /** Indonesian prose: "X adalah anak dari paman Y". Required. */
    descriptionId: text('description_id').notNull(),
    /** Arabic prose (optional, AI may provide). */
    descriptionAr: text('description_ar'),
    /** Ordered chain of hops. Empty for AI fallback when no path could be reconstructed. */
    pathJson: jsonb('path_json').notNull().$type<RelationPathStep[]>(),
    /** Whitelist source URL when `resolutionSource = 'ai_websearch'`. */
    citationUrl: text('citation_url'),
    citationDomain: text('citation_domain'),
    confidence: text('confidence', {
      enum: ['high', 'medium', 'low'],
    })
      .notNull()
      .default('medium'),
  },
  (t) => [
    // One canonical row per directed pair (active rows only).
    uniqueIndex('rel_paths_from_to_idx')
      .on(t.fromFigureId, t.toFigureId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('rel_paths_from_idx').on(t.fromFigureId),
    index('rel_paths_to_idx').on(t.toFigureId),
  ],
)

// ─── figure_locations ──────────────────────────────────────────────
export const figureLocations = pgTable(
  'figure_locations',
  {
    ...baseColumns,
    figureId: uuid('figure_id')
      .notNull()
      .references(() => figures.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    role: figureLocationRoleEnum('role').notNull(),
    periodStartAh: integer('period_start_ah'),
    periodEndAh: integer('period_end_ah'),
    notesAr: text('notes_ar'),
    notesId: text('notes_id'),
  },
  (t) => [
    index('figure_locations_figure_idx').on(t.figureId).where(sql`${t.deletedAt} IS NULL`),
    index('figure_locations_location_idx')
      .on(t.locationId)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)
