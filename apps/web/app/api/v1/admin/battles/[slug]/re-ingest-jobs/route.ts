// GET /api/v1/admin/battles/:slug/re-ingest-jobs
//
// Returns the latest re-ingest jobs for a battle so the edit UI can render
// the "Terakhir diperbarui oleh AI: <relative time>" badge and a per-job
// list of past refreshes (with mode + fieldsChanged metadata).
//
// Permission: `battles.view` — same gate as the battle detail page.
// Mirrors apps/web/app/api/v1/admin/figures/[slug]/re-ingest-jobs/route.ts.

import { z } from 'zod'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { battles, researchJobs } from '@athar/db/schema'
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
  await requirePermission(req, 'battles.view')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const url = new URL(req.url)
  const { limit } = validateQuery(url.searchParams, querySchema)

  // 1. Resolve the battle id so we can scope the job query. Accept trashed
  //    battles too — admins inspecting a soft-deleted record still want
  //    to see refresh history.
  const battle = await db.query.battles.findFirst({
    where: eq(battles.slug, slug),
    columns: { id: true },
  })
  if (!battle) {
    throw new ApiError('NOT_FOUND', `Sirah perang tidak ditemukan: ${slug}`)
  }

  // 2. Fetch the latest re-ingest jobs targeting this battleId. The
  //    `payload.battleId` lives inside JSONB.
  const rows = await db
    .select({
      id: researchJobs.id,
      type: researchJobs.type,
      status: researchJobs.status,
      payload: researchJobs.payload,
      messageId: researchJobs.messageId,
      resultBattleId: researchJobs.resultFigureId,
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
        eq(researchJobs.type, 'battle_reingest'),
        isNull(researchJobs.deletedAt),
        sql`${researchJobs.payload}->>'battleId' = ${battle.id}`,
      ),
    )
    .orderBy(desc(researchJobs.createdAt))
    .limit(limit)

  return ok(rows)
})
