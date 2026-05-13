// POST /api/v1/notifications/read-all — mark every unread notification for
// the current user as read.  Returns `{ updated: <count> }`.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import { notificationService } from '@/lib/server/services/notification.service'

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requireAuth(req)
  const result = await notificationService.markAllRead(userId)
  return ok(result)
})
