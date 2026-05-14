// GET /api/v1/admin/figures/:slug/re-ingest-jobs
//
// Returns the latest re-ingest jobs for a figure so the figure-detail UI
// can render a "Last refreshed: <relative time>, by <admin>" badge plus a
// timeline of past refreshes (with per-job mode + fieldsChanged metadata).
//
// Permission: `figures.view` — same gate as the figure detail page.
// See sibling: `POST /api/v1/admin/figures/[slug]/re-ingest`.

import { z } from 'zod'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { figures, researchJobs } from '@athar/db/schema'
import { ApiError, ok, validateParams, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

const paramsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9-]+$/, {
      message: 'Slug tidak valid (gunakan huruf kecil, angka, dan tanda hubung).',
    }),
})

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10) || 20, 1), 100) : 20)),
})

interface RouteCtx {
  params: Promise<{ slug: string }>
}

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'figures.view')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const url = new URL(req.url)
  const { limit } = validateQuery(url.searchParams, querySchema)

  // 1. Resolve the figure id so we can scope the job query. We deliberately
  //    accept trashed figures too — admins inspecting a soft-deleted record
  //    still want to see its refresh history.
  const figure = await db.query.figures.findFirst({
    where: eq(figures.slug, slug),
    columns: { id: true },
  })
  if (!figure) {
    throw new ApiError('NOT_FOUND', `Tokoh tidak ditemukan: ${slug}`)
  }

  // 2. Fetch the latest re-ingest jobs targeting this figureId. The
  //    `payload.figureId` lives inside JSONB — we use a parametric SQL
  //    expression on `payload->>'figureId'` for the predicate. Drizzle
  //    parameterises `figure.id` so this is injection-safe.
  const rows = await db
    .select({
      id: researchJobs.id,
      type: researchJobs.type,
      status: researchJobs.status,
      payload: researchJobs.payload,
      messageId: researchJobs.messageId,
      resultFigureId: researchJobs.resultFigureId,
      errorCode: researchJobs.errorCode,
      errorMessage: researchJobs.errorMessage,
      startedAt: researchJobs.startedAt,
      finishedAt: researchJobs.finishedAt,
      createdAt: researchJobs.createdAt,
      createdBy: researchJobs.createdBy,
    })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.type, 'figure_reingest'),
        isNull(researchJobs.deletedAt),
        sql`${researchJobs.payload}->>'figureId' = ${figure.id}`,
      ),
    )
    .orderBy(desc(researchJobs.createdAt))
    .limit(limit)

  return ok(rows)
})
