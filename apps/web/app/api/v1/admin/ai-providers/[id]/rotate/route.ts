// POST /api/v1/admin/ai-providers/[id]/rotate
// Body: { apiKey: string }
// Replaces the encrypted API key for a provider and returns the last 4 chars.
// Permission: `ai_providers.manage`.

import { z } from 'zod'

import { ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'

const paramsSchema = z.object({ id: z.string().uuid() })
const bodySchema = z.object({ apiKey: z.string().trim().min(1).max(500) })

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'ai_providers.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, bodySchema)
  const result = await aiSvc.rotateProviderKey(id, input, userId)
  return ok(result)
})
