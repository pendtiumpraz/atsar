// POST /api/v1/pdf/jobs  → enqueue a new PDF generation job
// GET  /api/v1/pdf/jobs  → list the current user's PDF jobs (paginated)
//
// See docs/IDEAS.md §5b (PDF Book Generator) and DATABASE.md §10.
//
// Flow (POST):
//   1. Authenticate + require `pdf.export` permission.
//   2. Validate body (figureIds 1-60, template slug, layout opts, lang mode).
//   3. Enforce quota via `quota.service` (soft TODO until wired).
//   4. Author override gate: non-admin users get author = profile values
//      and CANNOT customise; only users with `pdf.export_custom` may pass
//      `authorName` / `authorEmail` in the request body.
//   5. Insert `pdf_jobs` row with status='queued'.
//   6. Publish a QStash job → `/api/jobs/pdf` with `{ pdfJobId }`.
//   7. Return `{ id }` for the client to poll.

import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { pdfJobs } from '@athar/db/schema'

import { ApiError, ok, paginatedOk, validateBody, validateQuery, withErrorHandling } from '@/lib/server/api'
import { getEffectivePermissions, requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { listTemplateSlugs } from '@/lib/server/pdf'
// `ensureQuota` is gated behind a try/catch wrapper because the wider
// quota system relies on the user having an active subscription row,
// which not every dev seed has — we don't want PDF export to be blocked
// in local dev. The TODO below tracks tightening this for prod.
import { ensureQuota } from '@/lib/server/services/quota.service'

// ── Schemas ──────────────────────────────────────────────────────────

const paperSizeValues = ['a4', 'a5', 'letter', 'legal'] as const
const orientationValues = ['portrait', 'landscape'] as const
const languageModeValues = ['id', 'ar', 'both'] as const
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const jobTypeValues = ['single', 'multi', 'category'] as const

const createPdfJobSchema = z
  .object({
    figureIds: z.array(z.string().uuid()).min(1).max(60),
    templateSlug: z.string().min(1).max(64),
    paperSize: z.enum(paperSizeValues).default('a4'),
    orientation: z.enum(orientationValues).default('portrait'),
    languageMode: z.enum(languageModeValues).default('both'),
    titleAr: z.string().max(200).optional(),
    titleId: z.string().max(200).optional(),
    // Only effective for admins with `pdf.export_custom` — silently
    // ignored otherwise (overwritten with profile values below).
    authorName: z.string().min(1).max(200).optional(),
    authorEmail: z.string().email().max(254).optional(),
    includeIllustrations: z.boolean().default(true),
    includeMaps: z.boolean().default(true),
    includeTimeline: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    if (!listTemplateSlugs().includes(val.templateSlug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['templateSlug'],
        message: `Unknown template slug: ${val.templateSlug}`,
      })
    }
  })

const listPdfJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['queued', 'processing', 'done', 'failed']).optional(),
})

// ── POST: enqueue ────────────────────────────────────────────────────

export const POST = withErrorHandling(async (req) => {
  const { userId, session } = await requirePermission(req, 'pdf.export')
  const body = await validateBody(req, createPdfJobSchema)

  // Quota gate — soft fail in dev so missing subscription rows don't
  // block testing. Once subscription seeding is stable we can drop the
  // try/catch and let `ensureQuota` enforce strictly.
  try {
    await ensureQuota(userId, 'pdf_download')
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.code === 'SUBSCRIPTION_EXPIRED' || err.code === 'QUOTA_EXCEEDED')
    ) {
      // QUOTA_EXCEEDED is a hard stop — surface to user.
      if (err.code === 'QUOTA_EXCEEDED') throw err
      // SUBSCRIPTION_EXPIRED: TODO — gate this once trial seeding is wired.
      console.warn('[pdf/jobs] no active subscription, allowing for now', { userId })
    } else {
      throw err
    }
  }

  // Admin override: `pdf.export_custom` lets the caller pass arbitrary
  // author identity (used by reviewers building demo books "as if" a
  // particular user). For everyone else the profile is the source of truth.
  const perms = await getEffectivePermissions(userId)
  const canCustomAuthor = perms.has('pdf.export_custom')

  const profileName = (session?.user?.name as string | undefined) ?? ''
  const profileEmail = (session?.user?.email as string | undefined) ?? ''

  const authorName = canCustomAuthor ? body.authorName ?? profileName : profileName
  const authorEmail = canCustomAuthor ? body.authorEmail ?? profileEmail : profileEmail

  if (!authorName || !authorEmail) {
    // Profile incomplete — refuse to enqueue rather than ship a half-baked cover.
    throw new ApiError(
      'VALIDATION_ERROR',
      'Author name / email missing from profile; complete your profile before exporting.',
      { fieldErrors: { authorName: 'required', authorEmail: 'required' } },
    )
  }

  const jobType: (typeof jobTypeValues)[number] =
    body.figureIds.length === 1 ? 'single' : 'multi'

  const [inserted] = await db
    .insert(pdfJobs)
    .values({
      userId,
      jobType,
      figureIds: body.figureIds,
      templateSlug: body.templateSlug,
      paperSize: body.paperSize,
      orientation: body.orientation,
      languageMode: body.languageMode,
      titleAr: body.titleAr ?? null,
      titleId: body.titleId ?? null,
      authorName,
      authorEmail,
      includeIllustrations: body.includeIllustrations,
      includeMaps: body.includeMaps,
      includeTimeline: body.includeTimeline,
      status: 'queued',
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()

  if (!inserted) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to enqueue PDF job')
  }

  // Fire the QStash webhook. We deduplicate on the job id so an
  // accidental double-publish (e.g. retry from the client) doesn't
  // generate the same PDF twice.
  try {
    await publishJob(
      'pdf',
      { pdfJobId: inserted.id },
      { deduplicationId: `pdf-job-${inserted.id}` },
    )
  } catch (err) {
    // Mark the job failed if we can't even publish — better to surface
    // immediately than leave it in `queued` forever.
    await db
      .update(pdfJobs)
      .set({
        status: 'failed',
        errorMessage: 'Failed to publish job to QStash',
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(pdfJobs.id, inserted.id))
    console.error('[pdf/jobs] publishJob failed', err)
    throw new ApiError('INTERNAL_ERROR', 'Failed to publish PDF job', { cause: err })
  }

  return ok({ id: inserted.id, status: inserted.status }, undefined, { status: 202 })
})

// ── GET: list current user's jobs ─────────────────────────────────────

export const GET = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'pdf.export')
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, listPdfJobsQuerySchema)
  const offset = (query.page - 1) * query.perPage

  const where = and(
    eq(pdfJobs.userId, userId),
    isNull(pdfJobs.deletedAt),
    query.status ? eq(pdfJobs.status, query.status) : undefined,
  )

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(pdfJobs)
      .where(where)
      .orderBy(desc(pdfJobs.createdAt))
      .limit(query.perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(pdfJobs).where(where),
  ])

  return paginatedOk(rows, {
    page: query.page,
    perPage: query.perPage,
    total: totalRow[0]?.count ?? 0,
  })
})
