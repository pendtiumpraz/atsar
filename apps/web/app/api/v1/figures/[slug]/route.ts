// GET    /api/v1/figures/:slug   → detail with relations + locations
// PATCH  /api/v1/figures/:slug   → update (partial)
// PUT    /api/v1/figures/:slug   → alias for PATCH (legacy callers)
// DELETE /api/v1/figures/:slug   → soft delete (cascade to relations/locations)
//
// See docs/BACKEND.md §4 + docs/WIREFRAMES.md §6.

import { noContent, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { figureService } from '@/lib/server/services/figure.service'
import { updateFigureSchema } from '@/lib/server/services/figure.schemas'

type RouteCtx = { params: Promise<{ slug: string }> }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'figures.view')
  const { slug } = await ctx.params
  const figure = await figureService.getBySlug(slug)
  return ok(figure)
})

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug } = await ctx.params
  const body = await validateBody(req, updateFigureSchema)
  const updated = await figureService.update(slug, body, userId)
  return ok(updated)
})

// Legacy PUT alias — the FE client uses PATCH, but some older callers still
// send PUT.  Delegating keeps the surface backwards-compatible.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.delete')
  const { slug } = await ctx.params
  await figureService.softDelete(slug, userId)
  return noContent()
})
