// GET /api/v1/notifications — list the current user's own notifications.
// Paginated, newest-first.  `unreadOnly=true` filters to is_read = false.
//
// Auth: requireAuth (session only — no permission slug needed; users see
// only their own rows by virtue of the WHERE clause in the service).

import { z } from 'zod'

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import { notificationService } from '@/lib/server/services/notification.service'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  // URLSearchParams arrive as strings; coerce 'true'/'1' → true.
  unreadOnly: z
    .union([z.literal('true'), z.literal('1'), z.literal('false'), z.literal('0'), z.literal('')])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
})

export const GET = withErrorHandling(async (req) => {
  const { userId } = await requireAuth(req)
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, querySchema)
  const { rows, total, page, perPage } = await notificationService.listForUser(userId, query)
  return paginatedOk(rows, { page, perPage, total })
})
