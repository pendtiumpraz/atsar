// GET    /api/v1/admin/quizzes/:id — full detail (includes is_correct).
// PUT    /api/v1/admin/quizzes/:id — update quiz metadata.
// DELETE /api/v1/admin/quizzes/:id — soft delete (cascade to questions/options).
// Permission: `quiz.manage`.

import { z } from 'zod'

import {
  noContent,
  ok,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'
import { updateQuizSchema } from '@/lib/server/services/quiz.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'quiz.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const quiz = await quizService.getByIdForAdmin(id)
  return ok(quiz)
})

export const PUT = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'quiz.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const body = await validateBody(req, updateQuizSchema)
  const row = await quizService.update(id, body, userId)
  return ok(row)
})

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'quiz.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await quizService.softDelete(id, userId)
  return noContent()
})
