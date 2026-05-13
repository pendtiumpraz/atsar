// POST /api/v1/admin/quizzes/:id/questions — append a question (+
// options) to a quiz. Question order auto-increments unless explicitly
// provided.
// Permission: `quiz.manage`.

import { z } from 'zod'

import {
  created,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'
import { questionInputSchema } from '@/lib/server/services/quiz.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'quiz.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const body = await validateBody(req, questionInputSchema)
  const result = await quizService.addQuestion(id, body, userId)
  return created(result)
})
