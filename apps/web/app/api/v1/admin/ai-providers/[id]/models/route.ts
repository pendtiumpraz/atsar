// GET  /api/v1/admin/ai-providers/[id]/models — list models for a provider.
// POST /api/v1/admin/ai-providers/[id]/models — create a new model under the provider.
// Permission: `ai_models.manage` (POST) / `ai_providers.manage` (GET).

import { z } from 'zod'

import { created, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const createModelSchema = z.object({
  modelId: z.string().trim().min(1).max(120),
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
  const rows = await aiSvc.listProviderModels(id)
  return ok(rows)
})

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'ai_models.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, createModelSchema)
  const row = await aiSvc.createModel(id, input, userId)
  return created(row)
})
