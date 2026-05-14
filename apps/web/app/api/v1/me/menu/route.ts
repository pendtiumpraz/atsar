// GET /api/v1/me/menu — return the sidebar menu items the current user is
// allowed to see. Shared implementation with the server-rendered sidebar
// via `resolveMenuForUser`. Response: `ok([{ id, slug, labelId, labelAr,
// path, icon, parentId, displayOrder }])`.

import { ApiError, ok, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { resolveMenuForUser } from '@/lib/server/menu/resolve'

export const GET = withErrorHandling(async (req) => {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    throw new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.')
  }
  return ok(await resolveMenuForUser(userId))
})
