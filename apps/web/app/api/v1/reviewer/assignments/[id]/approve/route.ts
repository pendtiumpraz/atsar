// POST /api/v1/reviewer/assignments/[id]/approve
//   → Mark the assignment as approved. Bumps the parent content row to
//     status='approved' and publishedAt=now(). Writes a content_revisions
//     row with action='approved'.
//
// See docs/IDEAS.md §5c.2 (state machine) and §5c.7 (audit log).

import { z } from 'zod'

import { ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { reviewService } from '@/lib/server/services/review.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.review')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const updated = await reviewService.approve(id, userId)
  return ok(updated)
})
