// PUT /api/v1/admin/menus/access
// Replace the menu access matrix for a single role.
// Body: { roleId: uuid, menuIds: uuid[] }
// Permission: `menu.manage`.

import { z } from 'zod'

import { noContent, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as menuService from '@/lib/server/services/menu.service'

const bodySchema = z.object({
  roleId: z.string().uuid(),
  menuIds: z.array(z.string().uuid()).max(500),
})

export const PUT = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'menu.manage')
  const { roleId, menuIds } = await validateBody(req, bodySchema)
  await menuService.setRoleAccess(roleId, menuIds, userId)
  return noContent()
})
