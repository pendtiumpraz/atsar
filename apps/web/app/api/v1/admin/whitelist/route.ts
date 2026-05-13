// GET  /api/v1/admin/whitelist  — list every whitelist entry (incl. inactive)
// POST /api/v1/admin/whitelist  — create a new whitelist domain
// Permission: `whitelist.manage`. See docs/BACKEND.md §10.

import { z } from 'zod'

import { created, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { whitelistService } from '@/lib/server/services/whitelist.service'

const primaryLanguageEnum = z.enum(['ar', 'id', 'en'])

const createSchema = z.object({
  // Loose hostname: lowercase letters, digits, dots and dashes; 1–253 chars.
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, 'domain tidak valid'),
  displayName: z.string().trim().max(160).nullable().optional(),
  primaryLanguage: primaryLanguageEnum.nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  priority: z.coerce.number().int().min(-100).max(100).default(0),
  crawlRatePerMinute: z.coerce.number().int().min(1).max(600).default(30),
  isActive: z.boolean().optional(),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'whitelist.manage')
  const rows = await whitelistService.list()
  return ok(rows)
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'whitelist.manage')
  const input = await validateBody(req, createSchema)
  const row = await whitelistService.create(input, userId)
  return created(row)
})
