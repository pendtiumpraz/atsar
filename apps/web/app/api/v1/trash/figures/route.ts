// GET /api/v1/trash/figures → list soft-deleted figures.
// See docs/BACKEND.md §4.

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { figureService } from '@/lib/server/services/figure.service'
import { listTrashQuerySchema } from '@/lib/server/services/figure.schemas'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'trash.view')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listTrashQuerySchema)
  const { rows, total, page, perPage } = await figureService.listTrash(query)
  return paginatedOk(rows, { page, perPage, total })
})
