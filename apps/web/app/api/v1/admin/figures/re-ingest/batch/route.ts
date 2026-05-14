// POST /api/v1/admin/figures/re-ingest/batch
//
// Bulk variant of `POST /api/v1/admin/figures/[slug]/re-ingest`. Admin
// supplies up to 50 figure slugs plus a shared mode + focusFields + hints;
// we INSERT one `research_jobs` row per slug in a single `db.batch`, then
// publish a QStash message per row (best-effort).
//
// Response: 202 with { created, queued, failures }.
//   - created  = number of rows actually inserted (after dedupe within batch
//                and against any existing pending/running re-ingest job for
//                the same figure in the last hour).
//   - queued   = how many QStash messages we managed to publish.
//   - failures = [{ slug, reason }] for items skipped or publishes that
//                failed.
//
// Permission: `figures.update`.
// See sibling: `apps/web/app/api/v1/admin/figures/ingest/batch/route.ts`.

import { z } from 'zod'
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { figureCategories, figures, researchJobs } from '@athar/db/schema'
import { ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

// Keep in sync with the single re-ingest route — same allowed field surface.
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

const slugPattern = /^[a-z0-9-]+$/

const batchSchema = z.object({
  slugs: z
    .array(
      z
        .string()
        .min(1)
        .max(160)
        .regex(slugPattern, {
          message: 'Slug tidak valid (gunakan huruf kecil, angka, dan tanda hubung).',
        }),
    )
    .min(1)
    .max(50),
  mode: z.enum(['enrich', 'replace']).default('enrich'),
  focusFields: z.array(z.enum(RE_INGEST_FIELDS)).max(RE_INGEST_FIELDS.length).optional(),
  hints: z.string().trim().max(2000).optional(),
})

interface Failure {
  slug: string
  reason: string
}

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const input = await validateBody(req, batchSchema)
  const log = logger.child({ route: '/api/v1/admin/figures/re-ingest/batch', userId })

  // ── 1. Normalise + de-dup within the batch ─────────────────────────
  const seen = new Set<string>()
  const failures: Failure[] = []
  const uniqueSlugs: string[] = []
  for (const slug of input.slugs) {
    const key = slug.toLowerCase()
    if (seen.has(key)) {
      failures.push({ slug, reason: 'duplikat dalam batch' })
      continue
    }
    seen.add(key)
    uniqueSlugs.push(slug)
  }

  if (uniqueSlugs.length === 0) {
    return ok({ created: 0, queued: 0, failures }, undefined, { status: 202 })
  }

  // ── 2. Resolve all figures + their category slugs in one round-trip. ──
  // Trashed figures cannot be refreshed; we surface them as failures so the
  // admin sees exactly which slugs were skipped.
  const figureRows = await db
    .select({
      id: figures.id,
      slug: figures.slug,
      categoryId: figures.categoryId,
      categorySlug: figureCategories.slug,
      nameFullAr: figures.nameFullAr,
      nameFullId: figures.nameFullId,
      kunyahAr: figures.kunyahAr,
      kunyahId: figures.kunyahId,
      birthDateAh: figures.birthDateAh,
      deathDateAh: figures.deathDateAh,
      socialCategory: figures.socialCategory,
      specialty: figures.specialty,
      summaryAr: figures.summaryAr,
      summaryId: figures.summaryId,
      biographyAr: figures.biographyAr,
      biographyId: figures.biographyId,
    })
    .from(figures)
    .innerJoin(figureCategories, eq(figureCategories.id, figures.categoryId))
    .where(and(inArray(figures.slug, uniqueSlugs), isNull(figures.deletedAt)))

  const bySlug = new Map(figureRows.map((row) => [row.slug, row]))
  const resolved: typeof figureRows = []
  for (const slug of uniqueSlugs) {
    const row = bySlug.get(slug)
    if (!row) {
      failures.push({ slug, reason: 'tokoh tidak ditemukan atau berada di trash' })
      continue
    }
    resolved.push(row)
  }

  if (resolved.length === 0) {
    return ok({ created: 0, queued: 0, failures }, undefined, { status: 202 })
  }

  // ── 3. De-dup against recent (last hour) re-ingest jobs for the same
  //       figureId so a re-paste of the list doesn't double-spend AI credits.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentRows = await db
    .select({ payload: researchJobs.payload })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.type, 'figure_reingest'),
        gte(researchJobs.createdAt, hourAgo),
        sql`${researchJobs.status} IN ('pending', 'running')`,
      ),
    )

  const recentFigureIds = new Set<string>()
  for (const row of recentRows) {
    const p = row.payload as { figureId?: string } | null
    if (p?.figureId) recentFigureIds.add(p.figureId)
  }

  const toInsert = resolved.filter((row) => {
    if (recentFigureIds.has(row.id)) {
      failures.push({
        slug: row.slug,
        reason: 'job re-ingest baru saja diantrekan (< 1 jam terakhir)',
      })
      return false
    }
    return true
  })

  if (toInsert.length === 0) {
    return ok({ created: 0, queued: 0, failures }, undefined, { status: 202 })
  }

  // ── 4. Insert all rows in a single batch (Neon HTTP: db.batch). ──
  const insertStatements = toInsert.map((row) => {
    const originalSnapshot = {
      id: row.id,
      slug: row.slug,
      categorySlug: row.categorySlug,
      nameFullAr: row.nameFullAr,
      nameFullId: row.nameFullId,
      kunyahAr: row.kunyahAr,
      kunyahId: row.kunyahId,
      birthDateAh: row.birthDateAh,
      deathDateAh: row.deathDateAh,
      socialCategory: row.socialCategory,
      specialty: row.specialty,
      summaryAr: row.summaryAr,
      summaryId: row.summaryId,
      biographyAr: row.biographyAr,
      biographyId: row.biographyId,
    }
    const payload = {
      figureId: row.id,
      slug: row.slug,
      name: row.nameFullAr || row.nameFullId,
      categorySlug: row.categorySlug,
      mode: input.mode,
      focusFields: input.focusFields ?? [],
      hints: input.hints,
      originalSnapshot,
    }
    return db
      .insert(researchJobs)
      .values({
        type: 'figure_reingest',
        status: 'pending',
        payload,
        createdBy: userId,
      })
      .returning({ id: researchJobs.id })
  })

  const batchResults = (await db.batch(
    insertStatements as [
      (typeof insertStatements)[number],
      ...(typeof insertStatements)[number][],
    ],
  )) as Array<Array<{ id: string }>>

  const created = batchResults
    .map((r, i) => ({ jobId: r[0]?.id ?? null, figure: toInsert[i]! }))
    .filter((r) => r.jobId !== null) as Array<{
    jobId: string
    figure: (typeof toInsert)[number]
  }>

  // ── 5. Publish QStash messages — settle-all so one failure doesn't
  //       abort the rest. Rows stay `pending` if publish fails.
  const publishResults = await Promise.allSettled(
    created.map(({ jobId, figure }) =>
      publishJob(
        'research',
        { type: 'figure_reingest', jobId },
        { deduplicationId: `figure-reingest-${figure.id}-${jobId}` },
      ).then((res) => ({ jobId, messageId: res.messageId })),
    ),
  )

  let queued = 0
  const messageUpdates: Promise<unknown>[] = []
  for (let i = 0; i < publishResults.length; i++) {
    const r = publishResults[i]!
    const row = created[i]!
    if (r.status === 'fulfilled') {
      queued++
      messageUpdates.push(
        db
          .update(researchJobs)
          .set({ messageId: r.value.messageId, updatedAt: new Date() })
          .where(eq(researchJobs.id, row.jobId)),
      )
    } else {
      failures.push({
        slug: row.figure.slug,
        reason: `QStash publish gagal: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      })
    }
  }
  if (messageUpdates.length > 0) {
    await Promise.allSettled(messageUpdates)
  }

  log.info(
    { created: created.length, queued, failures: failures.length },
    'batch re-ingest complete',
  )

  return ok(
    { created: created.length, queued, failures },
    undefined,
    { status: 202 },
  )
})
