// GET /api/v1/admin/payments
// Paginated list of payments — defaults to `pending` so the admin queue
// surfaces work-to-do at the top. Permission: `subscriptions.view`.

import { z } from 'zod'
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import { db } from '@athar/db'
import { payments } from '@athar/db/schema'

import { ApiError, paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { requirePermission } from '@/lib/server/rbac'

const querySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'rejected']).optional(),
  userId: z.string().uuid().optional(),
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

  // Status filter: default to `pending` for the worklist view, but allow
  // callers to widen by passing `?userId=...` (typically from the user
  // detail page, where we want every payment regardless of state).
  const filters: SQL[] = [isNull(payments.deletedAt)]
  if (q.status) filters.push(eq(payments.status, q.status))
  else if (!q.userId) filters.push(eq(payments.status, 'pending'))
  if (q.userId) filters.push(eq(payments.userId, q.userId))
  const whereExpr = and(...filters)
  const offset = (q.page - 1) * q.perPage

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(payments)
      .where(whereExpr)
      .orderBy(desc(payments.createdAt))
      .limit(q.perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(whereExpr),
  ])

  return paginatedOk(rows, {
    page: q.page,
    perPage: q.perPage,
    total: totalRow[0]?.count ?? 0,
  })
})
