// POST /api/v1/admin/figures/:slug/re-ingest
//
// "Refresh Tokoh (AI)" flow: re-runs the Deep Research pipeline for an
// existing figure so admins can fill empty fields (`enrich` mode) or
// regenerate the biography from scratch (`replace` mode) without manually
// editing each one. Mirrors `POST /api/v1/admin/figures/ingest` but the row
// is identified by `slug` (not `name`) and the worker is told *not* to insert
// a new figure — it updates the existing row in-place.
//
// Body shape:
//   {
//     mode?: 'enrich' | 'replace',     // default 'enrich'
//     focusFields?: string[],          // columns the AI should focus on
//     hints?: string,                  // admin steering ("fokus periode di Baghdad")
//   }
//
// Response: 202 with { jobId, status: 'pending' }.
// Permission: `figures.update`.
// See docs/IDEAS.md (Refresh Tokoh via AI), docs/BACKEND.md §8.2.

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { figureCategories, figures, researchJobs } from '@athar/db/schema'
import { ApiError, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

// Re-ingest writeable surface — admins can ask the AI to refresh any of
// these. The worker still ground-truths against the FigureExtraction schema
// (extract.ts) so unknown keys are ignored downstream.
const RE_INGEST_FIELDS = [
  'nameFullAr',
  'nameFullId',
  'kunyahAr',
  'kunyahId',
  'birthDateAh',
  'deathDateAh',
  'socialCategory',
  'specialty',
  'summaryAr',
  'summaryId',
  'biographyAr',
  'biographyId',
  'citations',
] as const

const paramsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(160)
    // Match the slugify() output from the figure-ingest worker — lower-case
    // ASCII letters, digits, and hyphens only.
    .regex(/^[a-z0-9-]+$/, {
      message: 'Slug tidak valid (gunakan huruf kecil, angka, dan tanda hubung).',
    }),
})

export const reIngestRequestSchema = z.object({
  mode: z.enum(['enrich', 'replace']).default('enrich'),
  focusFields: z.array(z.enum(RE_INGEST_FIELDS)).max(RE_INGEST_FIELDS.length).optional(),
  hints: z.string().trim().max(2000).optional(),
})

interface RouteCtx {
  params: Promise<{ slug: string }>
}

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, reIngestRequestSchema)
  const log = logger.child({
    route: '/api/v1/admin/figures/[slug]/re-ingest',
    userId,
    slug,
  })

  // 1. Resolve the figure (active rows only — trashed figures cannot be
  //    refreshed; restore them first).
  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
  })
  if (!figure) {
    throw new ApiError('NOT_FOUND', `Tokoh tidak ditemukan: ${slug}`)
  }

  // 2. Resolve the category slug so the worker can re-use the existing
  //    `searchWhitelist(name)` → `extractFigureData` pipeline without
  //    needing a second round-trip.
  const category = await db.query.figureCategories.findFirst({
    where: eq(figureCategories.id, figure.categoryId),
    columns: { slug: true },
  })
  if (!category) {
    throw new ApiError(
      'INTERNAL_ERROR',
      'Kategori tokoh tidak ditemukan — data inkonsisten.',
    )
  }

  // 3. Capture the original snapshot so the diff is replayable — the admin
  //    UI uses this to highlight which fields the AI actually changed.
  const originalSnapshot = {
    id: figure.id,
    slug: figure.slug,
    categorySlug: category.slug,
    nameFullAr: figure.nameFullAr,
    nameFullId: figure.nameFullId,
    kunyahAr: figure.kunyahAr,
    kunyahId: figure.kunyahId,
    birthDateAh: figure.birthDateAh,
    deathDateAh: figure.deathDateAh,
    socialCategory: figure.socialCategory,
    specialty: figure.specialty,
    summaryAr: figure.summaryAr,
    summaryId: figure.summaryId,
    biographyAr: figure.biographyAr,
    biographyId: figure.biographyId,
  }

  // 4. Insert the job row first — same audit-first discipline as
  //    `figure_ingest` so a QStash publish failure still leaves a trace.
  const payload = {
    figureId: figure.id,
    slug: figure.slug,
    name: figure.nameFullAr || figure.nameFullId,
    categorySlug: category.slug,
    mode: input.mode,
    focusFields: input.focusFields ?? [],
    hints: input.hints,
    originalSnapshot,
  }

  const [job] = await db
    .insert(researchJobs)
    .values({
      type: 'figure_reingest',
      status: 'pending',
      payload,
      createdBy: userId,
    })
    .returning({ id: researchJobs.id })

  if (!job) {
    log.error('insert research_jobs returned no row')
    throw new ApiError('INTERNAL_ERROR', 'Gagal membuat job re-ingest.')
  }

  // 5. Fire the QStash webhook → `/api/jobs/research` (figure_reingest case).
  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'figure_reingest', jobId: job.id },
      {
        // Idempotent per figure per minute — double-submitting the same
        // refresh button is a no-op on the queue side.
        deduplicationId: `figure-reingest:${figure.id}:${job.id}`,
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
      'QStash publish failed — re-ingest job left pending for local debugging',
    )
    // Same fall-through as the single-ingest endpoint: in local dev the
    // tunnel often can't accept QStash callbacks. We leave the row pending
    // so the admin can debug from the UI.
  }

  return ok(
    {
      jobId: job.id,
      status: 'pending' as const,
      figureId: figure.id,
      mode: input.mode,
      messageId,
      ...(publishError ? { publishError } : {}),
    },
    undefined,
    { status: 202 },
  )
})
