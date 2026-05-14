// GET    /api/v1/admin/ai-providers/[id] — provider detail (with models).
// PATCH  /api/v1/admin/ai-providers/[id] — update metadata + isActive.
// PUT    /api/v1/admin/ai-providers/[id] — alias for PATCH (accepts same body).
// DELETE /api/v1/admin/ai-providers/[id] — soft delete (cascades to models).
//
// Permission: `ai_providers.manage`.

import { z } from 'zod'

import {
  noContent,
  ok,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'
import { SDK_ADAPTERS } from '@/lib/server/services/ai-provider.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sdkAdapter: z.enum(SDK_ADAPTERS).optional(),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'ai_providers.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const row = await aiSvc.getProviderById(id)
  return ok(row)
})

async function patchHandler(req: Request, ctx: RouteCtx) {
  const { userId } = await requirePermission(req, 'ai_providers.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await aiSvc.updateProvider(id, input, userId)
  return ok(row)
}

export const PATCH = withErrorHandling<RouteCtx>(patchHandler)
export const PUT = withErrorHandling<RouteCtx>(patchHandler)

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'ai_providers.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await aiSvc.softDeleteProvider(id, userId)
  return noContent()
})
