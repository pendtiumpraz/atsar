// POST /api/v1/trash/figures/:id/restore → clear deleted_at.
// See docs/BACKEND.md §4.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { figureService } from '@/lib/server/services/figure.service'

type RouteCtx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'trash.restore')
  const { id } = await ctx.params
  const restored = await figureService.restore(id, userId)
  return ok(restored)
})
