// Battles schema. See DATABASE.md §6.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import {
  battleTypeEnum,
  battleOutcomeEnum,
  battleParticipantRoleEnum,
  battleSideEnum,
  contentStatusEnum,
  datePrecisionEnum,
} from './enums.js'
import { figures } from './figures.js'
import { locations } from './locations.js'

// ─── battles ───────────────────────────────────────────────────────
export const battles = pgTable(
  'battles',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameId: text('name_id').notNull(),
    type: battleTypeEnum('type').notNull(),
    eventDateAh: integer('event_date_ah'),
    eventDateCe: integer('event_date_ce'),
    eventDateAhFull: date('event_date_ah_full'),
    eventDateCeFull: date('event_date_ce_full'),
    eventDatePrecision: datePrecisionEnum('event_date_precision'),
    eventDateNotes: text('event_date_notes'),
    locationId: uuid('location_id').references(() => locations.id),
    commanderId: uuid('commander_id').references(() => figures.id),
    opponentForce: text('opponent_force'),
    muslimCount: integer('muslim_count'),
    opponentCount: integer('opponent_count'),
    outcome: battleOutcomeEnum('outcome'),
    casualtiesMuslim: integer('casualties_muslim'),
    casualtiesOpponent: integer('casualties_opponent'),
    strategyAr: text('strategy_ar'),
    strategyId: text('strategy_id'),
    narrativeAr: text('narrative_ar'),
    narrativeId: text('narrative_id'),
    significanceAr: text('significance_ar'),
    significanceId: text('significance_id'),
    status: contentStatusEnum('status').notNull().default('draft'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('battles_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('battles_event_date_idx').on(t.eventDateAh).where(sql`${t.deletedAt} IS NULL`),
    index('battles_type_idx').on(t.type).where(sql`${t.deletedAt} IS NULL`),
    index('battles_status_idx').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── battle_phases ─────────────────────────────────────────────────
//
// `titleAr` / `titleId` carry the phase name; `descriptionAr` / `descriptionId`
// the narrative. The AI re-ingest pipeline emits `nameAr/Id` + `narrativeAr/Id`
// in its Zod contract — those map onto these existing columns (the worker
// performs the rename at insert time so we don't need a parallel set of
// columns).
//
// `arrowFromId` / `arrowToId` describe troop-movement vectors that the
// `<BattleMap />` overlay draws as an animated SVG line. `durationHours`
// drives the phase cards (e.g. "berlangsung 6 jam").
export const battlePhases = pgTable(
  'battle_phases',
  {
    ...baseColumns,
    battleId: uuid('battle_id')
      .notNull()
      .references(() => battles.id, { onDelete: 'cascade' }),
    phaseOrder: integer('phase_order').notNull(),
    titleAr: text('title_ar'),
    titleId: text('title_id'),
    descriptionAr: text('description_ar'),
    descriptionId: text('description_id'),
    phaseLocationId: uuid('phase_location_id').references(() => locations.id),
    arrowFromId: uuid('arrow_from_id').references(() => locations.id),
    arrowToId: uuid('arrow_to_id').references(() => locations.id),
    durationHours: integer('duration_hours'),
  },
  (t) => [index('battle_phases_battle_idx').on(t.battleId).where(sql`${t.deletedAt} IS NULL`)],
)

// ─── battle_participants ───────────────────────────────────────────
//
// Composite PK on (battleId, figureId) — a figure may appear in a battle
// only once. Rows are append-only (no soft-delete columns); cascade hard
// deletes through the battle/figure FKs.
//
// `side` defaults to 'muslim' because the entire pre-7.5.6 seed corpus is
// Muslim-side. The AI re-ingest pipeline now writes the explicit side for
// every newly-extracted row.
export const battleParticipants = pgTable(
  'battle_participants',
  {
    battleId: uuid('battle_id')
      .notNull()
      .references(() => battles.id, { onDelete: 'cascade' }),
    figureId: uuid('figure_id')
      .notNull()
      .references(() => figures.id, { onDelete: 'cascade' }),
    role: battleParticipantRoleEnum('role').notNull(),
    side: battleSideEnum('side').notNull().default('muslim'),
    notesAr: text('notes_ar'),
    notesId: text('notes_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.battleId, t.figureId] }),
    index('battle_participants_battle_idx').on(t.battleId),
    index('battle_participants_figure_idx').on(t.figureId),
  ],
)

// ─── battle_locations (multi-loc per battle) ───────────────────────
export const battleLocations = pgTable(
  'battle_locations',
  {
    battleId: uuid('battle_id')
      .notNull()
      .references(() => battles.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    notesAr: text('notes_ar'),
    notesId: text('notes_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.battleId, t.locationId] })],
)
