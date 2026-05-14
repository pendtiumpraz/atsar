// GET /api/v1/admin/figures/ingest-jobs/[jobId]
//
// Polled by the admin UI every ~5s while an AI ingest is in flight. Returns
// the current `status`, plus (on completion) the `resultFigureId` + the
// figure's slug so the UI can deep-link to the draft edit page.
//
// We don't expose another admin's jobs — `createdBy` must match the session.
// (Admins can override with `figures.publish` later if desired, but the
// current MVP is single-author per job.)

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { db } from '@athar/db'
import { figures, researchJobs } from '@athar/db/schema'
import { ApiError, ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

const paramsSchema = z.object({
  jobId: z.string().uuid(),
})

interface RouteCtx {
  params: Promise<{ jobId: string }>
}

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.create')
  const { jobId } = validateParams(await ctx.params, paramsSchema)

  const row = await db.query.researchJobs.findFirst({
    where: and(eq(researchJobs.id, jobId), eq(researchJobs.createdBy, userId)),
  })
  if (!row) {
    throw new ApiError('NOT_FOUND', 'Ingest job tidak ditemukan')
  }

  // If completed, fetch the figure slug so the UI can navigate to the
  // draft edit page without a second request.
  let figureSlug: string | null = null
  if (row.resultFigureId) {
    const fig = await db.query.figures.findFirst({
      where: eq(figures.id, row.resultFigureId),
      columns: { slug: true },
    })
    figureSlug = fig?.slug ?? null
  }

  return ok({
    id: row.id,
    type: row.type,
    status: row.status,
    payload: row.payload,
    resultFigureId: row.resultFigureId,
    figureSlug,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  })
})
