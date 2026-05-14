// Insert the singleton `security_settings` row with platform defaults.
//
// The lockout middleware (apps/web/lib/server/security/lockout.ts) reads
// this row at request time and falls back to identical in-code defaults
// when it is missing — so this seeder is idempotent and is safe to run on
// a partially-seeded database.

import { getSeedDb, logSeed } from './_helpers.js'
import { securitySettings } from '../schema/index.js'

export async function seed031SecuritySettings() {
  const db = getSeedDb()
  const existing = await db.select({ id: securitySettings.id }).from(securitySettings).limit(1)
  if (existing.length > 0) {
    logSeed('security_settings', 0, 'already present')
    return
  }
  const result = await db
    .insert(securitySettings)
    .values({
      loginLockoutTier1Threshold: 3,
      loginLockoutTier1DurationSec: 60,
      loginLockoutTier2Threshold: 5,
      loginLockoutTier2DurationSec: 300,
      loginLockoutTier3Threshold: 10,
      loginLockoutTier3DurationSec: 3600,
      attemptWindowSec: 3600,
    })
    .returning()
  logSeed('security_settings', result.length)
}
