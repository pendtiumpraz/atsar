// GET /api/v1/quizzes/:slug — return a quiz with its questions + options.
// `is_correct` is intentionally stripped from option payloads so the
// client can render the form but cannot inspect the answer key.
//
// See docs/BACKEND.md §4.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'

type RouteCtx = { params: Promise<{ slug: string }> }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requireAuth(req)
  const { slug } = await ctx.params
  const quiz = await quizService.getBySlugForUser(slug, userId)
  return ok(quiz)
})
