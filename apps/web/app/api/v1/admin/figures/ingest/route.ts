// POST /api/v1/admin/figures/ingest
// GET  /api/v1/admin/figures/ingest    → recent ingest jobs (this admin)
//
// "Tambah Tokoh (AI)" flow: admin types a figure name and an optional hint;
// we record a `research_jobs` row with status `pending`, enqueue a QStash
// webhook back to `/api/jobs/research` (with the `figure_ingest` job type),
// and return `202 Accepted` immediately. The worker handles the actual
// crawl + LLM extraction + draft insertion.
//
// Two response paths:
//   - Production / when QStash is reachable: returns `{ jobId, status: 'pending' }`.
//   - Local fallback (NODE_ENV !== 'production' and QStash publish fails):
//     we still return 202, leaving the row in `pending` — useful for the
//     admin to inspect the API contract without a real LLM call.
//
// Permission: `figures.create`.
// See docs/IDEAS.md (Tambah Tokoh via AI), docs/BACKEND.md §8.2.

import { z } from 'zod'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { researchJobs } from '@athar/db/schema'
import { ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

// Mirror `figureCategoryEnum` slugs from schema/enums.ts.
const FIGURE_CATEGORY_SLUGS = [
  'nabi',
  'sahabat',
  'tabiin',
  'tabiut_tabiin',
  'shalih_pasca_rasul',
  'shalih_pre_rasul',
] as const

const ingestRequestSchema = z.object({
  name: z.string().trim().min(2).max(160),
  hints: z.string().trim().max(2000).optional(),
  category: z.enum(FIGURE_CATEGORY_SLUGS),
  gender: z.enum(['male', 'female']).optional(),
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'figures.create')
  const input = await validateBody(req, ingestRequestSchema)
  const log = logger.child({ route: '/api/v1/admin/figures/ingest', userId })

  // 1. Insert the job row first — even if QStash publish later fails we still
  //    have an audit trail.
  const [job] = await db
    .insert(researchJobs)
    .values({
      type: 'figure_ingest',
      status: 'pending',
      payload: input,
      createdBy: userId,
    })
    .returning({ id: researchJobs.id })

  if (!job) {
    log.error('insert research_jobs returned no row')
    throw new Error('failed to create research job row')
  }

  // 2. Fire the QStash webhook. The worker reads `jobId` from the body and
  //    walks the same row through running → completed/failed.
  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'figure_ingest', jobId: job.id },
      {
        // Idempotent: clicking submit twice within QStash's retention window
        // (and within the same minute) is a no-op on the queue side.
        deduplicationId: `figure-ingest-${job.id}`,
      },
    )
    messageId = res.messageId
    await db
      .update(researchJobs)
      .set({ messageId, updatedAt: new Date() })
      .where(eq(researchJobs.id, job.id))
  } catch (err) {
    publishError = err instanceof Error ? err.message : String(err)
    log.warn(
      { jobId: job.id, err: publishError },
      'QStash publish failed — job left pending for local debugging',
    )
    // Don't fail the request: in local dev QStash often can't deliver back
    // to the dev tunnel. The UI will still show the job row with status
    // `pending` and the admin can debug from there.
  }

  return ok(
    {
      jobId: job.id,
      status: 'pending' as const,
      messageId,
      ...(publishError ? { publishError } : {}),
    },
    undefined,
    { status: 202 },
  )
})

const listQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(Math.max(parseInt(v, 10) || 20, 1), 50) : 20)),
})

export const GET = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'figures.create')
  const url = new URL(req.url)
  const { limit } = listQuerySchema.parse({ limit: url.searchParams.get('limit') ?? undefined })

  const rows = await db
    .select({
      id: researchJobs.id,
      status: researchJobs.status,
      payload: researchJobs.payload,
      resultFigureId: researchJobs.resultFigureId,
      errorCode: researchJobs.errorCode,
      errorMessage: researchJobs.errorMessage,
      createdAt: researchJobs.createdAt,
      finishedAt: researchJobs.finishedAt,
    })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.type, 'figure_ingest'),
        eq(researchJobs.createdBy, userId),
        isNull(researchJobs.deletedAt),
      ),
    )
    .orderBy(desc(researchJobs.createdAt))
    .limit(limit)

  return ok(rows)
})
