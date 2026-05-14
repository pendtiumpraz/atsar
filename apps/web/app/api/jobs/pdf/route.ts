// Job: generate a PDF book from a `pdf_jobs` row.
//
// Producers publish to `/api/jobs/pdf` with `{ pdfJobId }`
// (see `POST /api/v1/pdf/jobs`). This handler:
//   1. Verifies the QStash signature.
//   2. Loads the job row + every figure (with relations + locations).
//   3. Builds HTML via the selected template.
//   4. Renders to PDF buffer via puppeteer-core + @sparticuz/chromium.
//   5. Uploads the buffer to object storage (TODO — stubbed for now).
//   6. Marks the job done + writes a "pdf_ready" notification (TODO).
//
// See vercel.json — `maxDuration` is 300s on this route to accommodate
// Chromium cold-start + multi-figure rendering on the largest plans.

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import {
  citations,
  figures,
  figureLocations,
  figureRelations,
  notifications,
  pdfJobs,
} from '@athar/db/schema'

import { generatePdfBuffer, getTemplate, type FigureRich } from '@/lib/server/pdf'
import { withSignature } from '../_lib/with-signature.js'
// `incrementQuota` is used after a successful render so failed renders
// don't burn the user's monthly quota. Wrapped in try/catch in case the
// subscription row hasn't been seeded in the current environment.
import { incrementQuota } from '@/lib/server/services/quota.service'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const PdfJobPayload = z.object({
  pdfJobId: z.string().uuid(),
})

export const POST = withSignature(async (req) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON' } },
      { status: 422 },
    )
  }

  const parsed = PdfJobPayload.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'invalid pdf job payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }
  const { pdfJobId } = parsed.data

  // Load the job row.
  const job = await db.query.pdfJobs.findFirst({
    where: and(eq(pdfJobs.id, pdfJobId), isNull(pdfJobs.deletedAt)),
  })
  if (!job) {
    // 200 so QStash doesn't retry — the job genuinely doesn't exist.
    console.warn('[jobs/pdf] job not found, skipping', { pdfJobId })
    return Response.json({ ok: true, skipped: 'not_found' })
  }
  if (job.status === 'done') {
    return Response.json({ ok: true, skipped: 'already_done' })
  }

  // Mark processing so the UI can show a spinner — and so we have a
  // breadcrumb if the function dies mid-render.
  await db
    .update(pdfJobs)
    .set({ status: 'processing', updatedAt: new Date() })
    .where(eq(pdfJobs.id, job.id))

  try {
    // Validate template slug → builder.
    const builder = getTemplate(job.templateSlug ?? 'classic')
    if (!builder) {
      throw new Error(`Unknown template slug: ${job.templateSlug ?? '<none>'}`)
    }

    // Fetch figures + their relations + locations in three queries
    // (one per table). Cheaper than a big join when figureIds is small.
    const figureIds = (job.figureIds ?? []).filter(Boolean) as string[]
    if (figureIds.length === 0) {
      throw new Error('Job has no figureIds')
    }

    const [figureRows, relationRows, locationRows, citationRows] =
      await Promise.all([
        db
          .select()
          .from(figures)
          .where(and(inArray(figures.id, figureIds), isNull(figures.deletedAt))),
        db
          .select()
          .from(figureRelations)
          .where(
            and(
              inArray(figureRelations.figureId, figureIds),
              isNull(figureRelations.deletedAt),
            ),
          ),
        db
          .select()
          .from(figureLocations)
          .where(
            and(
              inArray(figureLocations.figureId, figureIds),
              isNull(figureLocations.deletedAt),
            ),
          ),
        // Citations are joined by (contentType, contentId) — the table
        // is polymorphic so we filter to `figure` rows in the WHERE.
        db
          .select()
          .from(citations)
          .where(
            and(
              eq(citations.contentType, 'figure'),
              inArray(citations.contentId, figureIds),
              isNull(citations.deletedAt),
            ),
          ),
      ])

    // Group child rows by figureId, then preserve the input order so the
    // book follows the user's selection sequence (not DB row order).
    const relsByFigure = new Map<string, typeof relationRows>()
    for (const r of relationRows) {
      const arr = relsByFigure.get(r.figureId) ?? []
      arr.push(r)
      relsByFigure.set(r.figureId, arr)
    }
    const locsByFigure = new Map<string, typeof locationRows>()
    for (const l of locationRows) {
      const arr = locsByFigure.get(l.figureId) ?? []
      arr.push(l)
      locsByFigure.set(l.figureId, arr)
    }
    const citesByFigure = new Map<string, typeof citationRows>()
    for (const c of citationRows) {
      const arr = citesByFigure.get(c.contentId) ?? []
      arr.push(c)
      citesByFigure.set(c.contentId, arr)
    }
    const figureById = new Map(figureRows.map((f) => [f.id, f]))

    const rich: FigureRich[] = []
    for (const id of figureIds) {
      const f = figureById.get(id)
      if (!f) continue // figure was soft-deleted between enqueue and render
      rich.push({
        ...f,
        relations: relsByFigure.get(id) ?? [],
        locations: locsByFigure.get(id) ?? [],
        citations: citesByFigure.get(id) ?? [],
      })
    }

    if (rich.length === 0) {
      throw new Error('All referenced figures are missing or soft-deleted')
    }

    // Build HTML → render to PDF.
    const html = builder({
      titleAr: job.titleAr,
      titleId: job.titleId,
      authorName: job.authorName ?? 'Atsar',
      authorEmail: job.authorEmail ?? 'noreply@athar.id',
      figures: rich,
      languageMode: job.languageMode,
      includeIllustrations: job.includeIllustrations,
      includeMaps: job.includeMaps,
      includeTimeline: job.includeTimeline,
    })

    const buffer = await generatePdfBuffer({
      html,
      paperSize: job.paperSize,
      orientation: job.orientation,
    })

    // TODO: upload `buffer` to object storage.
    //
    // Two viable backends are already in the Phase-3 plan:
    //   - Vercel Blob (`@vercel/blob put(buffer, { access: 'public' })`).
    //   - Cloudflare R2 via `aws4fetch` using `S3_*` env vars (preferred
    //     long-term; cheaper egress).
    //
    // For now we stash the byte length and synthesize a `/tmp/<id>.pdf`
    // marker so the rest of the pipeline (status polling, notifications)
    // can be wired and tested end-to-end without a storage dependency.
    const fileSizeBytes = buffer.length
    const fileUrl = `/tmp/${job.id}.pdf`
    console.info('[jobs/pdf] (stub) would upload PDF', {
      jobId: job.id,
      bytes: fileSizeBytes,
    })

    // Mark done.
    await db
      .update(pdfJobs)
      .set({
        status: 'done',
        fileUrl,
        fileSizeBytes,
        generatedAt: new Date(),
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(pdfJobs.id, job.id))

    // Increment quota on the user. Soft-fail in case subscription rows
    // aren't seeded — we don't want a quota bookkeeping miss to mark the
    // PDF as failed when the file is already produced.
    try {
      await incrementQuota(job.userId, 'pdf_download', 1)
    } catch (err) {
      console.warn('[jobs/pdf] quota increment failed (non-fatal)', err)
      // TODO: tighten once subscription seeding is stable in all envs.
    }

    // Notify the user — best-effort. If the notification service is ever
    // extracted into its own module (e.g. fan-out to email/push), swap
    // this inline insert for the service call.
    //
    // TODO: replace inline insert with `notificationService.create({...})`
    // once that service exists (see DATABASE.md §12).
    try {
      await db.insert(notifications).values({
        userId: job.userId,
        type: 'pdf_ready',
        title: 'PDF kamu siap diunduh',
        body: `Buku "${job.titleId ?? job.titleAr ?? 'tanpa judul'}" sudah selesai dibuat.`,
        actionUrl: fileUrl,
      })
    } catch (err) {
      console.warn('[jobs/pdf] notification insert failed (non-fatal)', err)
    }

    return Response.json({ ok: true, id: job.id, fileSizeBytes })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown render error'
    console.error('[jobs/pdf] render failed', { pdfJobId: job.id, err })
    await db
      .update(pdfJobs)
      .set({
        status: 'failed',
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(pdfJobs.id, job.id))

    // Return 200 on render failure — we don't want QStash to retry an
    // expensive render that already deterministically failed. The job
    // row carries the failure detail for the UI to surface.
    return Response.json({ ok: false, error: message, retry: false })
  }
})
