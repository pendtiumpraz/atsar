// POST /api/v1/admin/ai-providers/[id]/test
// Smoke-tests a provider's API key against its "list models" endpoint.
// Returns { ok: boolean, message?: string }.
// Permission: `ai_providers.manage`.

import { z } from 'zod'

import { ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'ai_providers.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const result = await aiSvc.testProvider(id)
  // Always 200 — the boolean tells the client whether the probe succeeded.
  return ok(result)
})
