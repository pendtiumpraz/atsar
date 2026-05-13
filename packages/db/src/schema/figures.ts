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
