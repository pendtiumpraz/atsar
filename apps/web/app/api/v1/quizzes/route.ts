// GET /api/v1/quizzes — list active quizzes (paginated, filter by
// category + difficulty). Public for any authenticated user who can
// attempt quizzes.
//
// See docs/BACKEND.md §4.

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'
import { listQuizzesQuerySchema } from '@/lib/server/services/quiz.service'

export const GET = withErrorHandling(async (req) => {
  // Listing public/active quizzes only requires the user be signed in.
  await requireAuth(req)
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listQuizzesQuerySchema)
  // Force isActive=true on the public route — admins use /admin/quizzes
  // for the full unfiltered listing.
  const { rows, total, page, perPage } = await quizService.list({
    ...query,
    isActive: true,
  })
  return paginatedOk(rows, { page, perPage, total })
})
