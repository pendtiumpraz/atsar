// POST /api/v1/quizzes/:slug/start — start a new attempt for the
// signed-in user. Returns the attempt id, server-side start time, total
// question count and the quiz's countdown duration (if any) so the
// client can run its timer.
//
// Permission: `quiz.attempt`.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'

type RouteCtx = { params: Promise<{ slug: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'quiz.attempt')
  const { slug } = await ctx.params
  const result = await quizService.startAttempt(slug, userId)
  return ok(result, undefined, { status: 201 })
})
