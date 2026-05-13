// Reusable column groups & helpers. Spread into table definitions.

import { uuid, timestamp } from 'drizzle-orm/pg-core'

/**
 * Standard audit columns. Spread into every table.
 * createdBy/updatedBy/deletedBy are loose UUIDs (no FK constraint).
 */
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'),
  updatedBy: uuid('updated_by'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  deletedBy: uuid('deleted_by'),
}

// NOTE: dualDate helper was removed because TS can't infer dynamic keys.
// Inline the 6 columns directly in tables that need them — see figures.ts / battles.ts.
