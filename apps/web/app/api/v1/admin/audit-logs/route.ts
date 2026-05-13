// GET /api/v1/admin/audit-logs
// Paginated list of audit log entries with filters.
// Permission: `audit_log.view`. See docs/BACKEND.md §11.

import { z } from 'zod'
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'

import { db } from '@athar/db'
import { auditLogs } from '@athar/db/schema'

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

const ACTIONS = [
  'create',
  'update',
  'soft_delete',
  'restore',
  'hard_delete',
  'login',
  'logout',
  'role_change',
  'permission_change',
  'config_change',
  'crawl_complete',
] as const

const querySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.enum(ACTIONS).optional(),
  resourceType: z.string().trim().min(1).max(64).optional(),
  resourceId: z.string().uuid().optional(),
  from: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().datetime().optional()),
  to: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().datetime().optional()),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(50),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'audit_log.view')

  const url = new URL(req.url)
  const q = validateQuery(url.searchParams, querySchema)

  const filters: SQL[] = []
  if (q.actorId) filters.push(eq(auditLogs.actorId, q.actorId))
  if (q.action) filters.push(eq(auditLogs.action, q.action))
  if (q.resourceType) filters.push(eq(auditLogs.resourceType, q.resourceType))
  if (q.resourceId) filters.push(eq(auditLogs.resourceId, q.resourceId))
  if (q.from) filters.push(gte(auditLogs.createdAt, new Date(q.from)))
  if (q.to) filters.push(lte(auditLogs.createdAt, new Date(q.to)))

  const whereClause = filters.length > 0 ? and(...filters) : undefined
  const offset = (q.page - 1) * q.perPage

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(q.perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(whereClause),
  ])

  const total = totalRow[0]?.count ?? 0

  return paginatedOk(rows, {
    page: q.page,
    perPage: q.perPage,
    total,
  })
})
