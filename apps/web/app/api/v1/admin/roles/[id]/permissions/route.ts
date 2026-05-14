// PUT /api/v1/admin/roles/[id]/permissions
// Replace the full permission set for one role. Body: { permissionIds: uuid[] }
// Permission: `roles.manage`. Matrix replacement runs inside a transaction.

import { z } from 'zod'

import { noContent, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as roleService from '@/lib/server/services/role.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  permissionIds: z.array(z.string().uuid()).max(500),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const PUT = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'roles.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const { permissionIds } = await validateBody(req, bodySchema)
  await roleService.setPermissions(id, permissionIds, userId)
  return noContent()
})
