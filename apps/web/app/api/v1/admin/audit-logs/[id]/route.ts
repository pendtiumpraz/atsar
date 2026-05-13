// GET /api/v1/admin/audit-logs/[id]
// Fetch a single audit log entry, primarily for the diff modal in the
// admin UI. Permission: `audit_log.view`. See docs/BACKEND.md §11.

import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { db } from '@athar/db'
import { auditLogs } from '@athar/db/schema'

import { ApiError, ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'audit_log.view')

  const rawParams = await ctx.params
  const { id } = validateParams(rawParams, paramsSchema)

  const rows = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new ApiError('NOT_FOUND', 'Audit log entry not found')
  }

  return ok(row)
})
