// Drizzle schema entry. Full table definitions land in Phase 1.1 (DATABASE.md §1–§13).
// Placeholder so package compiles & migrations machinery exists.

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Bootstrap table used to verify connectivity & migration system.
 * Will be replaced with full schema in Phase 1.1.3+.
 */
export const _bootstrap = pgTable('_athar_bootstrap', {
  id: uuid('id').primaryKey().defaultRandom(),
  note: text('note').notNull().default('Athar bootstrap row'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
