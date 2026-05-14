// GET /api/v1/admin/ai-role-assignments
//   → { assignments: RoleAssignmentDto[], models: ActiveModelOption[] }
//   Every seeded AI role is returned, even when not yet pinned to a model.
//
// PUT /api/v1/admin/ai-role-assignments
//   Body: { role: AIRole, modelId: uuid }
//   Atomically swaps the active model for `role`.
//
// Permission: `ai_providers.manage`.

import { z } from 'zod'

import { ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'
import { AI_ROLES } from '@/lib/server/services/ai-provider.service'

const putSchema = z.object({
  role: z.enum(AI_ROLES),
  modelId: z.string().uuid(),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'ai_providers.manage')
  const data = await aiSvc.listRoleAssignments()
  return ok(data)
})

export const PUT = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'ai_providers.manage')
  const input = await validateBody(req, putSchema)
  const row = await aiSvc.setRoleAssignment(input, userId)
  return ok(row)
})
