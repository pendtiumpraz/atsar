// GET /api/v1/admin/fonts/assignments
// Returns the full slot → font map (one entry per FontRole, `null` when
// unassigned).  Powers the "Active Slots" tab in the admin UI.
// Permission: `fonts.view`.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as fontService from '@/lib/server/services/font.service'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'fonts.view')
  const data = await fontService.getActiveAssignments()
  return ok(data)
})
