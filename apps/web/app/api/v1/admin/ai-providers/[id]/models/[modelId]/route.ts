// PUT    /api/v1/admin/ai-providers/[id]/models/[modelId] — update a model.
// PATCH  /api/v1/admin/ai-providers/[id]/models/[modelId] — alias for PUT.
// DELETE /api/v1/admin/ai-providers/[id]/models/[modelId] — soft-delete model.
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

const paramsSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string().uuid(),
})

const updateModelSchema = z.object({
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

type RouteCtx = { params: Promise<{ id: string; modelId: string }> | { id: string; modelId: string } }

async function updateHandler(req: Request, ctx: RouteCtx) {
  const { userId } = await requirePermission(req, 'ai_models.manage')
  const { modelId } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateModelSchema)
  const row = await aiSvc.updateModel(modelId, input, userId)
  return ok(row)
}

export const PUT = withErrorHandling<RouteCtx>(updateHandler)
export const PATCH = withErrorHandling<RouteCtx>(updateHandler)

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'ai_models.manage')
  const { modelId } = validateParams(await ctx.params, paramsSchema)
  await aiSvc.softDeleteModel(modelId, userId)
  return noContent()
})
