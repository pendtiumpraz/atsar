// PUT /api/v1/admin/ai-role-assignments/[roleSlug]
//   Body: { modelId: uuid } — assign a model to the given role.
//
// Permission: `ai_providers.manage`.

import { z } from 'zod'

import { ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'
import { AI_ROLES } from '@/lib/server/services/ai-provider.service'

const paramsSchema = z.object({ roleSlug: z.enum(AI_ROLES) })
const bodySchema = z.object({ modelId: z.string().uuid() })

type RouteCtx = {
  params: Promise<{ roleSlug: string }> | { roleSlug: string }
}

export const PUT = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'ai_providers.manage')
  const { roleSlug } = validateParams(await ctx.params, paramsSchema)
  const { modelId } = await validateBody(req, bodySchema)
  const row = await aiSvc.setRoleAssignment({ role: roleSlug, modelId }, userId)
  return ok(row)
})
