// GET /api/v1/subscriptions/me
// Returns the current user's active subscription (with tier details) or 404.
// See docs/BACKEND.md §2.5 / IDEAS §6.5.

import { ApiError, ok, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { getActive } from '@/lib/server/services/subscription.service'

export const GET = withErrorHandling(async (req) => {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    throw new ApiError('AUTH_REQUIRED', 'Authentication required')
  }

  const sub = await getActive(session.user.id)
  if (!sub) {
    // 404 communicates "no active plan" cleanly; UI can route to billing.
    throw new ApiError('NOT_FOUND', 'No active subscription')
  }

  return ok(sub)
})
