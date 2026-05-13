// GET  /api/v1/admin/quizzes  — list quizzes including inactive ones.
// POST /api/v1/admin/quizzes  — create a new quiz shell.
// Permission: `quiz.manage`.

import {
  created,
  paginatedOk,
  validateBody,
  validateQuery,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { quizService } from '@/lib/server/services/quiz.service'
import {
  createQuizSchema,
  listQuizzesQuerySchema,
} from '@/lib/server/services/quiz.service'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'quiz.manage')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listQuizzesQuerySchema)
  const { rows, total, page, perPage } = await quizService.listAdmin(query)
  return paginatedOk(rows, { page, perPage, total })
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'quiz.manage')
  const body = await validateBody(req, createQuizSchema)
  const row = await quizService.create(body, userId)
  return created(row)
})
