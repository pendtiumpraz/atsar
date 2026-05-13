// GET /api/v1/trash/battles → list soft-deleted battles.
// See docs/BACKEND.md §4.

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { battleService } from '@/lib/server/services/battle.service'
import { listTrashQuerySchema } from '@/lib/server/services/battle.schemas'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'trash.view')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listTrashQuerySchema)
  const { rows, total, page, perPage } = await battleService.listTrash(query)
  return paginatedOk(rows, { page, perPage, total })
})
