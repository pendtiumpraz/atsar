// PUT /api/v1/admin/users/[id]/roles
// Replace the user's role assignments (transactionally).
// Permission: `users.set_role`.

import { z } from 'zod'

import { noContent, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as userService from '@/lib/server/services/user.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  roleIds: z.array(z.string().uuid()).max(50),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const PUT = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'users.set_role')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const { roleIds } = await validateBody(req, bodySchema)
  // TODO(actor): resolve actorId from session once auth middleware lands.
  await userService.setRoles(id, roleIds, null)
  return noContent()
})
