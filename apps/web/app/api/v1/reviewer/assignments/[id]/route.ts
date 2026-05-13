// GET /api/v1/reviewer/assignments/[id]
//   → Single assignment hydrated with its content row + all citations.
//     The reviewer hits this when opening the side-by-side review UI
//     (§5c.4). Only the assigned reviewer (or admins with figures.review)
//     can read.
//
// See docs/IDEAS.md §5c.4.

import { z } from 'zod'

import { ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { reviewService } from '@/lib/server/services/review.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.review')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const detail = await reviewService.getAssignmentDetail(id, userId)
  return ok(detail)
})
