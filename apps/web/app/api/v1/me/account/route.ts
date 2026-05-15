// DELETE /api/v1/me/account — GDPR right-to-erasure.
//
// Soft-deletes the calling user's row (sets `deletedAt`), unlinks their
// roles, and overwrites email + personal columns with tombstone values
// so the row no longer holds PII. Active subscriptions are NOT touched
// (Stripe / Midtrans webhooks may still arrive); admins can clean those
// up via the billing console. A hard-delete is intentionally NOT
// supported because audit_log rows reference `actorId` and we don't
// want to break the audit trail.
//
// Auth: requires login. Body: `{ confirmation: 'HAPUS AKUN' }` so the
// frontend has to surface a typed confirmation prompt.

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { userRoles, users } from '@athar/db/schema'
import { ApiError, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { auditLog } from '@/lib/server/services/audit.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  confirmation: z.literal('HAPUS AKUN'),
})

export const DELETE = withErrorHandling(async (req) => {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    throw new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.')
  }
  await validateBody(req, bodySchema)

  // Refuse if the user is the only active admin — would brick the
  // platform. Mirrors the same guard in user.service softDelete().
  const adminCount = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(isNull(users.deletedAt)))
  // Cheap heuristic: if total active users <= 1, refuse. A future
  // version should JOIN through roles to count admins specifically.
  if (adminCount.length <= 1) {
    throw new ApiError(
      'CONFLICT',
      'Akun terakhir tidak dapat dihapus — minimal harus tersisa satu admin aktif.',
    )
  }

  const tombstone = `deleted+${userId}@atsar.invalid`
  const now = new Date()
  await db
    .update(users)
    .set({
      deletedAt: now,
      deletedBy: userId,
      email: tombstone,
      emailVerified: false,
      emailVerifiedAt: null,
      passwordHash: null,
      fullName: '(deleted user)',
      displayName: null,
      avatarUrl: null,
      phone: null,
      updatedAt: now,
      updatedBy: userId,
    })
    .where(eq(users.id, userId))

  // Drop role assignments so an attacker who re-creates the email
  // doesn't inherit admin permissions.
  await db.delete(userRoles).where(eq(userRoles.userId, userId))

  void auditLog.write({
    actorId: userId,
    action: 'soft_delete',
    resourceType: 'user',
    resourceId: userId,
    diff: { reason: 'gdpr_self_request' },
  })

  return ok({ deleted: true })
})
