// GET    /api/v1/battles/:slug   → detail with phases + participant count
// PATCH  /api/v1/battles/:slug   → update (partial)
// PUT    /api/v1/battles/:slug   → alias for PATCH (legacy callers)
// DELETE /api/v1/battles/:slug   → soft delete (cascade to phases)
//
// See docs/BACKEND.md §4 + docs/WIREFRAMES.md §6.

import { noContent, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { battleService } from '@/lib/server/services/battle.service'
import { updateBattleSchema } from '@/lib/server/services/battle.schemas'

type RouteCtx = { params: Promise<{ slug: string }> }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'battles.view')
  const { slug } = await ctx.params
  const battle = await battleService.getBySlug(slug)
  return ok(battle)
})

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'battles.update')
  const { slug } = await ctx.params
  const body = await validateBody(req, updateBattleSchema)
  const updated = await battleService.update(slug, body, userId)
  return ok(updated)
})

// Legacy PUT alias — the FE client uses PATCH, but some older callers still
// send PUT.  Delegating keeps the surface backwards-compatible.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'battles.delete')
  const { slug } = await ctx.params
  await battleService.softDelete(slug, userId)
  return noContent()
})
