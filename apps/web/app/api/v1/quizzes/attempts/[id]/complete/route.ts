// POST /api/v1/quizzes/attempts/:id/complete — finalize an attempt.
// Returns the server-computed score, correct count, and completion
// timestamp. Refuses to finalize an attempt that is not owned by the
// caller or that has already been completed.
//
// Permission: `quiz.attempt`.

import { z } from 'zod'

import { ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'quiz.attempt')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const result = await quizService.completeAttempt(id, userId)
  return ok(result)
})
