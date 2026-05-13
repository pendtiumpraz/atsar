// PUT    /api/v1/admin/whitelist/[id]  — update a whitelist domain
// DELETE /api/v1/admin/whitelist/[id]  — soft-delete a whitelist domain
// Permission: `whitelist.manage`.

import { z } from 'zod'

import { noContent, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { whitelistService } from '@/lib/server/services/whitelist.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const primaryLanguageEnum = z.enum(['ar', 'id', 'en'])

const updateSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/, 'domain tidak valid')
    .optional(),
  displayName: z.string().trim().max(160).nullable().optional(),
  primaryLanguage: primaryLanguageEnum.nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  priority: z.coerce.number().int().min(-100).max(100).optional(),
  crawlRatePerMinute: z.coerce.number().int().min(1).max(600).optional(),
  isActive: z.boolean().optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const PUT = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'whitelist.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await whitelistService.update(id, input, userId)
  return ok(row)
})

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'whitelist.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await whitelistService.softDelete(id, userId)
  return noContent()
})
