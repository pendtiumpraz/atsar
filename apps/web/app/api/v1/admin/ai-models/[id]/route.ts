// GET    /api/v1/admin/ai-models/[id]
// PATCH  /api/v1/admin/ai-models/[id] — partial update (used to toggle isActive).
// PUT    /api/v1/admin/ai-models/[id] — alias for PATCH.
// DELETE /api/v1/admin/ai-models/[id] — soft delete.
// Permission: `ai_models.manage`.

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

const paramsSchema = z.object({ id: z.string().uuid() })

const updateSchema = z.object({
  modelId: z.string().trim().min(1).max(120).optional(),
  displayName: z.string().trim().max(160).nullable().optional(),
  capabilities: z.array(z.string().trim().min(1).max(32)).max(16).nullable().optional(),
  contextWindow: z.number().int().positive().nullable().optional(),
  maxOutputTokens: z.number().int().positive().nullable().optional(),
  supportsStreaming: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
  supportsVision: z.boolean().optional(),
  inputPricePer1m: z.string().trim().max(32).nullable().optional(),
  outputPricePer1m: z.string().trim().max(32).nullable().optional(),
  cachedPricePer1m: z.string().trim().max(32).nullable().optional(),
  releaseDate: z.string().trim().max(20).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'ai_providers.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const row = await aiSvc.getModelById(id)
  return ok(row)
})

async function updateHandler(req: Request, ctx: RouteCtx) {
  const { userId } = await requirePermission(req, 'ai_models.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await aiSvc.updateModel(id, input, userId)
  return ok(row)
}

export const PATCH = withErrorHandling<RouteCtx>(updateHandler)
export const PUT = withErrorHandling<RouteCtx>(updateHandler)

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'ai_models.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await aiSvc.softDeleteModel(id, userId)
  return noContent()
})
