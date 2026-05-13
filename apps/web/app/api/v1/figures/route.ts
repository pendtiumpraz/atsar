// GET /api/v1/figures        → list active figures (paginated, FTS+filter)
// POST /api/v1/figures       → create new figure (draft by default)
//
// See docs/BACKEND.md §4 + docs/WIREFRAMES.md §6.

import {
  ok,
  paginatedOk,
  validateBody,
  validateQuery,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { figureService } from '@/lib/server/services/figure.service'
import {
  createFigureSchema,
  listFiguresQuerySchema,
} from '@/lib/server/services/figure.schemas'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'figures.view')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listFiguresQuerySchema)
  const { rows, total, page, perPage } = await figureService.list(query)
  return paginatedOk(rows, { page, perPage, total })
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'figures.create')
  const body = await validateBody(req, createFigureSchema)
  const created = await figureService.create(body, userId)
  return ok(created, undefined, { status: 201 })
})
