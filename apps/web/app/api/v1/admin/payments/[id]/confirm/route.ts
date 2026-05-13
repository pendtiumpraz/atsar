// POST /api/v1/admin/payments/:id/confirm
// Admin confirms a manual-transfer payment, marks it `confirmed`, and
// activates the linked subscription in one flow. Idempotent — replaying
// the request against an already-confirmed payment returns the row
// without re-running the activation side-effects.
//
// Body: { tierId, billingCycle } — the tier/cycle being purchased.
// Permission: `payments.confirm`.

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { payments } from '@athar/db/schema'

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
import { activate } from '@/lib/server/services/subscription.service'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const bodySchema = z.object({
  tierId: z.string().uuid(),
  billingCycle: z.enum(['monthly', 'yearly']),
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
  const body = await validateBody(req, bodySchema)

  const payment = await db.query.payments.findFirst({
    where: and(eq(payments.id, id), isNull(payments.deletedAt)),
  })
  if (!payment) {
    throw new ApiError('NOT_FOUND', `Payment not found: ${id}`)
  }
  if (!payment.subscriptionId) {
    throw new ApiError('CONFLICT', 'Payment is not linked to a subscription')
  }

  // Idempotent: a previously-confirmed payment short-circuits. We still
  // re-call `activate` because that helper is itself idempotent — it bails
  // out if the subscription is already active on the same tier/cycle.
  const alreadyConfirmed = payment.status === 'confirmed'
  const now = new Date()

  if (!alreadyConfirmed) {
    if (payment.status === 'rejected') {
      throw new ApiError('CONFLICT', 'Payment was already rejected')
    }
    await db
      .update(payments)
      .set({
        status: 'confirmed',
        confirmedBy: session.user.id,
        confirmedAt: now,
        updatedBy: session.user.id,
        updatedAt: now,
      })
      .where(eq(payments.id, id))

    await auditLog.write({
      actorId: session.user.id,
      actorRole: 'admin',
      action: 'update',
      resourceType: 'payment',
      resourceId: id,
      diff: { status: [payment.status, 'confirmed'] },
    })
  }

  const subscription = await activate({
    subscriptionId: payment.subscriptionId,
    tierId: body.tierId,
    billingCycle: body.billingCycle,
    activatedBy: session.user.id,
  })

  return ok({ payment: { id, status: 'confirmed' as const }, subscription })
})
