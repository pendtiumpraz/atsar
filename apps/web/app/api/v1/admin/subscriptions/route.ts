// GET /api/v1/admin/subscriptions
// Paginated list of subscriptions for the admin panel. Filterable by status.
// Permission: `subscriptions.view`.

import { z } from 'zod'

import { ApiError, paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { requirePermission } from '@/lib/server/rbac'
import { listAll } from '@/lib/server/services/subscription.service'

const querySchema = z.object({
  status: z.enum(['trial', 'active', 'expired', 'cancelled']).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
})

export const GET = withErrorHandling(async (req) => {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    throw new ApiError('AUTH_REQUIRED', 'Authentication required')
  }
  await requirePermission('subscriptions.view')(session.user.id)

  const url = new URL(req.url)
  const q = validateQuery(url.searchParams, querySchema)

  const { rows, total, page, perPage } = await listAll(q)
  return paginatedOk(rows, { page, perPage, total })
})
