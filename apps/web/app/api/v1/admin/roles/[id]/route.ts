// GET    /api/v1/admin/roles/[id]
// PATCH  /api/v1/admin/roles/[id]   (partial)
// PUT    /api/v1/admin/roles/[id]   (alias for PATCH; legacy callers)
// DELETE /api/v1/admin/roles/[id]   (soft-delete; refuses system roles)
// Permission: `roles.manage`.

import { z } from 'zod'

import { noContent, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as roleService from '@/lib/server/services/role.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  nameId: z.string().trim().min(1).max(120).optional(),
  nameAr: z.string().trim().max(120).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'roles.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const row = await roleService.getById(id)
  return ok(row)
})

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'roles.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await roleService.update(id, input, userId)
  return ok(row)
})

// Legacy PUT alias — FE client uses PATCH.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'roles.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await roleService.softDelete(id, userId)
  return noContent()
})
