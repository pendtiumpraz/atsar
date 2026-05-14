// Security settings service — singleton config row.
//
// The row is owned by the lockout middleware
// (apps/web/lib/server/security/lockout.ts) but exposed for admin editing
// via GET/PATCH /api/v1/admin/security. Both readers are tolerant to a
// missing row — they fall back to the same defaults seeded by
// `packages/db/src/seeders/031_security_settings.ts`.
//
// Result shape is intentionally flat (no JSON sub-fields) so the admin
// form can bind one column per <Input>. Validation lives at the route
// boundary; this service trusts its inputs.

import { eq } from 'drizzle-orm'

import { db } from '@athar/db'
import { securitySettings } from '@athar/db/schema'

export type SecuritySettingsRow = typeof securitySettings.$inferSelect

export const SECURITY_DEFAULTS = {
  loginLockoutTier1Threshold: 3,
  loginLockoutTier1DurationSec: 60,
  loginLockoutTier2Threshold: 5,
  loginLockoutTier2DurationSec: 300,
  loginLockoutTier3Threshold: 10,
  loginLockoutTier3DurationSec: 3600,
  attemptWindowSec: 3600,
} as const

export type SecurityDefaults = typeof SECURITY_DEFAULTS

/** Snapshot consumed by the lockout middleware — only the tuning knobs. */
export interface LockoutConfig {
  loginLockoutTier1Threshold: number
  loginLockoutTier1DurationSec: number
  loginLockoutTier2Threshold: number
  loginLockoutTier2DurationSec: number
  loginLockoutTier3Threshold: number
  loginLockoutTier3DurationSec: number
  attemptWindowSec: number
}

/**
 * Fetch (or lazily create) the singleton row. We do NOT auto-insert on
 * read — if the row is gone we return the defaults so login is never
 * accidentally bricked by a wiped table. The admin form's "Reset to
 * defaults" CTA is the explicit recovery path.
 */
export async function getSettings(): Promise<SecuritySettingsRow | null> {
  const rows = await db.select().from(securitySettings).limit(1)
  return rows[0] ?? null
}

/**
 * Lockout middleware entry point. Always resolves — returns `SECURITY_DEFAULTS`
 * when the row is absent or the DB call rejects.
 */
export async function getLockoutConfig(): Promise<LockoutConfig> {
  try {
    const row = await getSettings()
    if (!row) return { ...SECURITY_DEFAULTS }
    return {
      loginLockoutTier1Threshold: row.loginLockoutTier1Threshold,
      loginLockoutTier1DurationSec: row.loginLockoutTier1DurationSec,
      loginLockoutTier2Threshold: row.loginLockoutTier2Threshold,
      loginLockoutTier2DurationSec: row.loginLockoutTier2DurationSec,
      loginLockoutTier3Threshold: row.loginLockoutTier3Threshold,
      loginLockoutTier3DurationSec: row.loginLockoutTier3DurationSec,
      attemptWindowSec: row.attemptWindowSec,
    }
  } catch (err) {
    console.warn('[security] getLockoutConfig fell back to defaults:', err)
    return { ...SECURITY_DEFAULTS }
  }
}

export type SecurityUpdateInput = Partial<LockoutConfig>

/**
 * Update the singleton row. Creates it on first call if absent so the
 * admin UI's first save acts like an "initialize" without requiring the
 * seeder to have run.
 */
export async function updateSettings(
  input: SecurityUpdateInput,
  actorId: string,
): Promise<SecuritySettingsRow> {
  const existing = await getSettings()
  if (!existing) {
    const [row] = await db
      .insert(securitySettings)
      .values({
        ...SECURITY_DEFAULTS,
        ...input,
        updatedBy: actorId,
      })
      .returning()
    return row!
  }
  const [row] = await db
    .update(securitySettings)
    .set({
      ...input,
      updatedBy: actorId,
      updatedAt: new Date(),
    })
    .where(eq(securitySettings.id, existing.id))
    .returning()
  return row!
}
