// Fonts admin-configurable schema. See DATABASE.md §9.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import { fontScriptEnum, fontSourceEnum, fontRoleEnum } from './enums.js'
import { users } from './auth.js'

// ─── fonts ─────────────────────────────────────────────────────────
export const fonts = pgTable(
  'fonts',
  {
    ...baseColumns,
    name: text('name').notNull(),
    family: text('family').notNull(),
    script: fontScriptEnum('script').notNull(),
    source: fontSourceEnum('source').notNull(),
    googleFamilyName: text('google_family_name'),
    customUrl: text('custom_url'),
    filePaths: jsonb('file_paths').$type<Record<string, string>>(),
    weights: integer('weights').array(),
    styles: text('styles').array(),
    unicodeRange: text('unicode_range'),
    previewTextAr: text('preview_text_ar'),
    previewTextId: text('preview_text_id'),
    license: text('license'),
    isActive: boolean('is_active').notNull().default(false),
  },
  (t) => [
    uniqueIndex('fonts_family_active_idx')
      .on(t.family)
      .where(sql`${t.deletedAt} IS NULL`),
    index('fonts_script_idx').on(t.script).where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── font_assignments ──────────────────────────────────────────────
export const fontAssignments = pgTable(
  'font_assignments',
  {
    ...baseColumns,
    role: fontRoleEnum('role').notNull(),
    fontId: uuid('font_id')
      .notNull()
      .references(() => fonts.id),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    activatedBy: uuid('activated_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('font_assignments_role_active_idx')
      .on(t.role)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── font_assignment_history ───────────────────────────────────────
export const fontAssignmentHistory = pgTable('font_assignment_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: fontRoleEnum('role').notNull(),
  oldFontId: uuid('old_font_id').references(() => fonts.id),
  newFontId: uuid('new_font_id').references(() => fonts.id),
  changedBy: uuid('changed_by').references(() => users.id),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow(),
})
