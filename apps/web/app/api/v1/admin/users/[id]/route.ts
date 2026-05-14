// GET    /api/v1/admin/users/[id]   — `users.view`
// PATCH  /api/v1/admin/users/[id]   — `users.update` (partial)
// PUT    /api/v1/admin/users/[id]   — alias for PATCH (legacy callers)
// DELETE /api/v1/admin/users/[id]   — `users.delete` (soft, refuses last admin)

import { z } from 'zod'

import { noContent, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as userService from '@/lib/server/services/user.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  displayName: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  locale: z.enum(['id', 'ar', 'en']).optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'users.view')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const row = await userService.getById(id)
  return ok(row)
})

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'users.update')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await userService.update(id, input, userId)
  return ok(row)
})

// Legacy PUT alias — FE client uses PATCH.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'users.delete')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await userService.softDelete(id, userId)
  return noContent()
})
