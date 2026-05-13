// GET /api/v1/ai/usage — current user's AI usage history (this billing period).
//
// Auth: any authenticated user. Users can only see their own logs.
// Filters: ?role=&from=&to=&page=&perPage=
// Returns: paginated list + summary { totalCredits, totalCalls,
//          totalInputTokens, totalOutputTokens }.
//
// See docs/BACKEND.md §6.

import { z } from 'zod'
import { and, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm'

import { db } from '@athar/db'
import { aiUsageLogs, aiModels, aiProviders } from '@athar/db/schema'

import { paginatedOk, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'

const ROLES = ['chat', 'agent', 'doc_analyzer', 'avatar', 'embedding'] as const

const querySchema = z.object({
  role: z.enum(ROLES).optional(),
  from: z.string().datetime({ offset: true }).optional().or(z.string().datetime().optional()),
  to: z.string().datetime({ offset: true }).optional().or(z.string().datetime().optional()),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (req) => {
  const { userId } = await requireAuth(req)

  const url = new URL(req.url)
  const q = validateQuery(url.searchParams, querySchema)

  // Default window: current calendar month (start … now).
  const now = new Date()
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const fromDate = q.from ? new Date(q.from) : defaultFrom
  const toDate = q.to ? new Date(q.to) : now

  const filters: SQL[] = [
    eq(aiUsageLogs.userId, userId),
    gte(aiUsageLogs.createdAt, fromDate),
    lte(aiUsageLogs.createdAt, toDate),
  ]
  if (q.role) filters.push(eq(aiUsageLogs.role, q.role))

  const whereClause = and(...filters)
  const offset = (q.page - 1) * q.perPage

  const [rows, totalRow, summaryRow] = await Promise.all([
    db
      .select({
        id: aiUsageLogs.id,
        createdAt: aiUsageLogs.createdAt,
        role: aiUsageLogs.role,
        requestType: aiUsageLogs.requestType,
        inputTokens: aiUsageLogs.inputTokens,
        outputTokens: aiUsageLogs.outputTokens,
        cachedTokens: aiUsageLogs.cachedTokens,
        creditsUsed: aiUsageLogs.creditsUsed,
        durationMs: aiUsageLogs.durationMs,
        status: aiUsageLogs.status,
        contextSummary: aiUsageLogs.contextSummary,
        modelId: aiUsageLogs.modelId,
        modelDisplayName: aiModels.displayName,
        modelSlug: aiModels.modelId,
        providerId: aiUsageLogs.providerId,
        providerSlug: aiProviders.slug,
        providerName: aiProviders.name,
      })
      .from(aiUsageLogs)
      .leftJoin(aiModels, eq(aiUsageLogs.modelId, aiModels.id))
      .leftJoin(aiProviders, eq(aiUsageLogs.providerId, aiProviders.id))
      .where(whereClause)
      .orderBy(desc(aiUsageLogs.createdAt))
      .limit(q.perPage)
      .offset(offset),

    db
      .select({ count: sql<number>`count(*)::int` })
      .from(aiUsageLogs)
      .where(whereClause),

    db
      .select({
        totalCredits: sql<string>`coalesce(sum(${aiUsageLogs.creditsUsed}), 0)::text`,
        totalCalls: sql<number>`count(*)::int`,
        totalInputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}), 0)::int`,
        totalOutputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}), 0)::int`,
        totalCachedTokens: sql<number>`coalesce(sum(${aiUsageLogs.cachedTokens}), 0)::int`,
      })
      .from(aiUsageLogs)
      .where(whereClause),
  ])

  const total = totalRow[0]?.count ?? 0
  const summary = summaryRow[0] ?? {
    totalCredits: '0',
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
  }

  return paginatedOk(
    rows,
    { page: q.page, perPage: q.perPage, total },
    {
      summary: {
        totalCredits: Number(summary.totalCredits),
        totalCalls: summary.totalCalls,
        totalInputTokens: summary.totalInputTokens,
        totalOutputTokens: summary.totalOutputTokens,
        totalCachedTokens: summary.totalCachedTokens,
      },
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    },
  )
})
