// GET /api/v1/reviewer/queue
//   → Paginated list of *my* (current reviewer's) assignments.
//     Defaults to status=pending — that's the "inbox" view.
//
// See docs/IDEAS.md §5c.4 (Review UI) and BACKEND.md §5.

import { z } from 'zod'

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { reviewService } from '@/lib/server/services/review.service'

const reviewStatusValues = ['pending', 'in_progress', 'completed'] as const

const querySchema = z.object({
  status: z.enum(reviewStatusValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})

export const GET = withErrorHandling(async (req) => {
  // `figures.review` covers battles too — both content types are reviewed
  // by the same role (see §5c.10).
  const { userId } = await requirePermission(req, 'figures.review')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, querySchema)
  const { rows, total, page, perPage } = await reviewService.getQueueForReviewer(
    userId,
    query,
  )
  return paginatedOk(rows, { page, perPage, total })
})
