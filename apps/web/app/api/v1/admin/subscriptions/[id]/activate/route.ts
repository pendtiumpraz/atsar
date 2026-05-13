// POST /api/v1/admin/subscriptions/:id/activate
// Admin marks a subscription as active after manual payment verification.
// Body: { tierId, billingCycle }. Permission: `subscriptions.activate`.

import { z } from 'zod'

import {
  ApiError,
  ok,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { requirePermission } from '@/lib/server/rbac'
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
  await requirePermission('subscriptions.activate')(session.user.id)

  const rawParams = await ctx.params
  const { id } = validateParams(rawParams, paramsSchema)
  const body = await validateBody(req, bodySchema)

  const updated = await activate({
    subscriptionId: id,
    tierId: body.tierId,
    billingCycle: body.billingCycle,
    activatedBy: session.user.id,
  })

  return ok(updated)
})
