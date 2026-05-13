// POST /api/v1/quizzes/attempts/:id/answer — submit a single answer
// to an open attempt. The service verifies ownership + open state and
// computes correctness server-side (clients never send is_correct).
//
// Permission: `quiz.attempt`.

import { z } from 'zod'

import { ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'
import { submitAnswerSchema } from '@/lib/server/services/quiz.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'quiz.attempt')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const body = await validateBody(req, submitAnswerSchema)
  const result = await quizService.submitAnswer(
    id,
    body.questionId,
    body.selectedOptionId,
    userId,
  )
  return ok(result)
})
