// GET /api/v1/admin/menus
// Return the active menu tree for the admin matrix UI.
// Permission: `menu.manage`.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as menuService from '@/lib/server/services/menu.service'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'menu.manage')
  const tree = await menuService.listTree()
  return ok(tree)
})
