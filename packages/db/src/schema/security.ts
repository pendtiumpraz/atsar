// Security settings — singleton config table (one row only).
//
// Stores tunable thresholds for tiered login lockout (see
// apps/web/lib/server/security/lockout.ts). Kept as its own table — rather
// than wedged into a generic kv `settings` table — so the columns are
// strongly typed at the Drizzle layer and an admin form can bind directly.
//
// Singleton invariant: exactly one row. Enforced at the application layer
// (the seeder inserts the single row; the PATCH endpoint updates by id),
// not via a partial-unique index, because there is no natural key to dedupe
// on. If the row is missing the lockout middleware falls back to safe
// defaults so the platform is never accidentally bricked by a wiped table.

import { pgTable, uuid, integer, timestamp } from 'drizzle-orm/pg-core'

export const securitySettings = pgTable('security_settings', {
  id: uuid('id').primaryKey().defaultRandom(),

  // ── Login lockout (tiered, rolling 1h window) ────────────────────
  // tierN is "fail count within attemptWindowSec at which lockout of
  // tierNDurationSec is triggered". Tiers escalate monotonically;
  // tier3 should be >= tier2 > tier1.
  loginLockoutTier1Threshold: integer('login_lockout_tier1_threshold').notNull().default(3),
  loginLockoutTier1DurationSec: integer('login_lockout_tier1_duration_sec').notNull().default(60),
  loginLockoutTier2Threshold: integer('login_lockout_tier2_threshold').notNull().default(5),
  loginLockoutTier2DurationSec: integer('login_lockout_tier2_duration_sec').notNull().default(300),
  loginLockoutTier3Threshold: integer('login_lockout_tier3_threshold').notNull().default(10),
  loginLockoutTier3DurationSec: integer('login_lockout_tier3_duration_sec').notNull().default(3600),

  // Rolling window over which failed-login counts accumulate.
  attemptWindowSec: integer('attempt_window_sec').notNull().default(3600),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by'),
})
