// GET / PATCH /api/v1/admin/security
//
// Reads / updates the singleton `security_settings` row that drives the
// tiered login-lockout middleware (`lib/server/security/lockout.ts`).
//
// Permission: `security.manage`. The route writes its own audit_log entry
// on PATCH so the admin trail captures threshold/duration changes.

import { z } from 'zod'

import {
  ok,
  validateBody,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import {
  getSettings,
  SECURITY_DEFAULTS,
  updateSettings,
} from '@/lib/server/services/security.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateSchema = z
  .object({
    loginLockoutTier1Threshold: z.number().int().min(1).max(100).optional(),
    loginLockoutTier1DurationSec: z.number().int().min(10).max(86_400).optional(),
    loginLockoutTier2Threshold: z.number().int().min(1).max(100).optional(),
    loginLockoutTier2DurationSec: z.number().int().min(10).max(86_400).optional(),
    loginLockoutTier3Threshold: z.number().int().min(1).max(100).optional(),
    loginLockoutTier3DurationSec: z.number().int().min(10).max(86_400).optional(),
    attemptWindowSec: z.number().int().min(60).max(86_400).optional(),
  })
  .refine(
    (v) => {
      const t1 = v.loginLockoutTier1Threshold ?? SECURITY_DEFAULTS.loginLockoutTier1Threshold
      const t2 = v.loginLockoutTier2Threshold ?? SECURITY_DEFAULTS.loginLockoutTier2Threshold
      const t3 = v.loginLockoutTier3Threshold ?? SECURITY_DEFAULTS.loginLockoutTier3Threshold
      return t1 <= t2 && t2 <= t3
    },
    {
      message: 'Tier threshold harus menaik: tier1 ≤ tier2 ≤ tier3',
    },
  )

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'security.manage')
  const row = await getSettings()
  return ok({
    settings: row ?? { id: null, ...SECURITY_DEFAULTS, createdAt: null, updatedAt: null, updatedBy: null },
    defaults: SECURITY_DEFAULTS,
  })
})

export const PATCH = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'security.manage')
  const input = await validateBody(req, updateSchema)
  const row = await updateSettings(input, userId)
  return ok({ settings: row })
})
