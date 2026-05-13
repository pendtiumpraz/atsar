// GET /api/v1/admin/permissions
// List all (non-soft-deleted) permission rows for the admin matrix UI.
// Permission: `permissions.manage`. See docs/BACKEND.md §5.4.

import { asc, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { permissions } from '@athar/db/schema'

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'permissions.manage')
  const rows = await db
    .select()
    .from(permissions)
    .where(isNull(permissions.deletedAt))
    .orderBy(asc(permissions.group), asc(permissions.slug))
  return ok(rows)
})
