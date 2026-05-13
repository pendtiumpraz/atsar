// GET /api/v1/battles        → list active battles (paginated, FTS+filter)
// POST /api/v1/battles       → create new battle (draft by default)
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
import { battleService } from '@/lib/server/services/battle.service'
import {
  createBattleSchema,
  listBattlesQuerySchema,
} from '@/lib/server/services/battle.schemas'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'battles.view')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listBattlesQuerySchema)
  const { rows, total, page, perPage } = await battleService.list(query)
  return paginatedOk(rows, { page, perPage, total })
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'battles.create')
  const body = await validateBody(req, createBattleSchema)
  const created = await battleService.create(body, userId)
  return ok(created, undefined, { status: 201 })
})
