// POST /api/v1/reviewer/assignments/[id]/reject
//   Body: { reason: string }
//   → Close the assignment with decision='reject'. The parent content's
//     status is intentionally untouched — admin decides next steps.
//
// See docs/IDEAS.md §5c.2 + §5c.7.

import { z } from 'zod'

import { ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { reviewService } from '@/lib/server/services/review.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  reason: z.string().trim().min(1, 'reason is required').max(4000),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.review')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const { reason } = await validateBody(req, bodySchema)
  const updated = await reviewService.reject(id, userId, reason)
  return ok(updated)
})
