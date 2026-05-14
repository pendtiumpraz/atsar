// GET /api/v1/admin/battles/ingest-jobs/[jobId]
//
// Polled by the admin UI every ~5s while an AI ingest is in flight. Returns
// the current `status`, plus (on completion) the resulting `battleId` and
// `battleSlug` so the UI can deep-link to the draft edit page.
//
// We don't expose another admin's jobs — `createdBy` must match the session.
//
// Mirrors apps/web/app/api/v1/admin/figures/ingest-jobs/[jobId]/route.ts.

import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { db } from '@athar/db'
import { battles, researchJobs } from '@athar/db/schema'
import { ApiError, ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'

const paramsSchema = z.object({
  jobId: z.string().uuid(),
})

interface RouteCtx {
  params: Promise<{ jobId: string }>
}

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'battles.create')
  const { jobId } = validateParams(await ctx.params, paramsSchema)

  const row = await db.query.researchJobs.findFirst({
    where: and(eq(researchJobs.id, jobId), eq(researchJobs.createdBy, userId)),
  })
  if (!row) {
    throw new ApiError('NOT_FOUND', 'Ingest job tidak ditemukan')
  }

  // If completed, fetch the battle slug so the UI can navigate to the
  // draft edit page without a second request. `resultFigureId` is the
  // shared "result content id" column on research_jobs.
  let battleSlug: string | null = null
  const resultBattleId = row.resultFigureId
  if (resultBattleId) {
    const battle = await db.query.battles.findFirst({
      where: eq(battles.id, resultBattleId),
      columns: { slug: true },
    })
    battleSlug = battle?.slug ?? null
  }

  return ok({
    id: row.id,
    type: row.type,
    status: row.status,
    payload: row.payload,
    resultBattleId,
    battleSlug,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    createdAt: row.createdAt,
  })
})
