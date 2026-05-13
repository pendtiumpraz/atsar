// DELETE /api/v1/trash/figures/:id/hard → permanent delete.
// Row MUST already be in trash (deleted_at IS NOT NULL).  Requires
// the `trash.hard_delete` permission — see docs/BACKEND.md §4 + §5.4.

import { noContent, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { figureService } from '@/lib/server/services/figure.service'

type RouteCtx = { params: Promise<{ id: string }> }

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'trash.hard_delete')
  const { id } = await ctx.params
  await figureService.hardDelete(id, userId)
  return noContent()
})
