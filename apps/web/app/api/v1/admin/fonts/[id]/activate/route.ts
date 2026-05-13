// POST /api/v1/admin/fonts/[id]/activate
// Body: { role: FontRole }
// Atomically replaces the active font for the given slot.  Permission:
// `fonts.activate`.  See docs/IDEAS.md §3b.

import { z } from 'zod'

import {
  ok,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as fontService from '@/lib/server/services/font.service'
import { FONT_ROLES } from '@/lib/server/services/font.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  role: z.enum(FONT_ROLES),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'fonts.activate')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const { role } = await validateBody(req, bodySchema)
  const row = await fontService.activate({ role, fontId: id, activatedBy: userId })
  return ok(row)
})
