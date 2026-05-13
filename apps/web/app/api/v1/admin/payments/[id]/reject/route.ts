// POST /api/v1/admin/payments/:id/reject
// Admin rejects a pending payment with a reason. Reason is recorded both
// in the audit diff and appended to the linked subscription's `notes` so
// the user-facing billing page can surface it.
// Permission: `payments.confirm`.

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { payments, subscriptions } from '@athar/db/schema'

import {
  ApiError,
  ok,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const bodySchema = z.object({
  reason: z.string().trim().min(1).max(500),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    throw new ApiError('AUTH_REQUIRED', 'Authentication required')
  }
  await requirePermission('payments.confirm')(session.user.id)

  const rawParams = await ctx.params
  const { id } = validateParams(rawParams, paramsSchema)
  const { reason } = await validateBody(req, bodySchema)

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.id, id), isNull(payments.deletedAt)),
  })
  if (!payment) {
    throw new ApiError('NOT_FOUND', `Payment not found: ${id}`)
  }
  if (payment.status === 'confirmed') {
    throw new ApiError('CONFLICT', 'Cannot reject an already-confirmed payment')
  }
  if (payment.status === 'rejected') {
    // Idempotent — no-op replay returns the existing row state.
    return ok({ id, status: 'rejected' as const, reason })
  }

  const now = new Date()

  await db
    .update(payments)
    .set({
      status: 'rejected',
      updatedBy: session.user.id,
      updatedAt: now,
    })
    .where(eq(payments.id, id))

  if (payment.subscriptionId) {
    // Append the reason to subscription notes so the admin UI / user-facing
    // billing page can surface it. Use a timestamped line so multiple
    // rejections are auditable in-line.
    const stamp = `[${now.toISOString()}] payment rejected: ${reason}`
    await db
      .update(subscriptions)
      .set({
        notes: stamp,
        updatedBy: session.user.id,
        updatedAt: now,
      })
      .where(eq(subscriptions.id, payment.subscriptionId))
  }

  await auditLog.write({
    actorId: session.user.id,
    actorRole: 'admin',
    action: 'update',
    resourceType: 'payment',
    resourceId: id,
    diff: { status: [payment.status, 'rejected'], reason },
  })

  return ok({ id, status: 'rejected' as const, reason })
})
