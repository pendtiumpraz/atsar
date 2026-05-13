// POST /api/v1/notifications/[id]/read — mark a single notification as read.
// Service refuses (NOT_FOUND) when the row does not belong to the caller.

import { z } from 'zod'

import { ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import { notificationService } from '@/lib/server/services/notification.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requireAuth(req)
  const { id } = validateParams(await ctx.params, paramsSchema)
  const row = await notificationService.markRead(id, userId)
  return ok(row)
})
