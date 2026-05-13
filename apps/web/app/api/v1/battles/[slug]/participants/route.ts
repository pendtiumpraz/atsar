// GET  /api/v1/battles/:slug/participants → list participants with figure names.
// POST /api/v1/battles/:slug/participants → add a participant.
//
// See docs/BACKEND.md §4.

import { ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { battleService } from '@/lib/server/services/battle.service'
import { addParticipantSchema } from '@/lib/server/services/battle.schemas'

type RouteCtx = { params: Promise<{ slug: string }> }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'battles.view')
  const { slug } = await ctx.params
  const participants = await battleService.listParticipants(slug)
  return ok(participants)
})

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'battles.update')
  const { slug } = await ctx.params
  const body = await validateBody(req, addParticipantSchema)
  const created = await battleService.addParticipant(slug, body, userId)
  return ok(created, undefined, { status: 201 })
})
