// GET /api/v1/battles/:slug/phases → list phases ordered by phaseOrder.
// See docs/BACKEND.md §4.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { battleService } from '@/lib/server/services/battle.service'

type RouteCtx = { params: Promise<{ slug: string }> }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'battles.view')
  const { slug } = await ctx.params
  const phases = await battleService.listPhases(slug)
  return ok(phases)
})
