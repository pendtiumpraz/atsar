// Job: Deep Research per figure.
//
// Producer is either:
//   - the admin batch endpoint (`POST /api/v1/admin/research`), or
//   - the admin AI ingest endpoint (`POST /api/v1/admin/figures/ingest`,
//     which references a `research_jobs` row by id), or
//   - a follow-up trigger from another job.
//
// The route accepts two payload shapes:
//
//   1. Legacy batch crawl (no `type` field, or `type: 'crawl'`):
//      `{ figureName, categorySlug, sourceUrls? }`
//      — used by the batch admin endpoint; no `research_jobs` row.
//
//   2. AI-assisted ingest (`type: 'figure_ingest'`):
//      `{ type: 'figure_ingest', jobId }`
//      — pulls the original input (name + hints + category + gender) from
//        the referenced `research_jobs` row and updates that row through
//        running → completed/failed as the worker progresses.
//
// Pipeline (mirrors docs/BACKEND.md §8.2):
//   1. Resolve candidate URLs (whitelist search) if the caller didn't provide them.
//   2. Fetch up to 5 source pages with per-domain rate limiting.
//   3. Call the `agent` LLM (`generateObject`) to extract a bilingual draft.
//   4. Insert a draft `figures` row + per-field `citations`.
//   5. Auto-assign a reviewer (round-robin via Redis counter).
//   6. Enqueue the `extract` sub-job to compute embeddings (TODO stub).
//
// All work is wrapped in `withSignature` so only QStash can invoke it.

import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import {
  citations,
  figureCategories,
  figures,
  researchJobs,
  reviewAssignments,
  roles,
  userRoles,
  whitelistDomains,
} from '@athar/db/schema'

import { withSignature } from '../_lib/with-signature.js'
import { publishJob } from '@/lib/server/qstash'
import { redis } from '@/lib/server/upstash'
import { logger } from '@/lib/server/logger'
import {
  extractFigureData,
  fetchPage,
  RateLimitExceededError,
  searchWhitelist,
} from '@/lib/server/research'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_SOURCES = 5

// Legacy batch payload — kept verbatim for backwards compat with the
// existing `POST /api/v1/admin/research` endpoint.
const CrawlPayload = z.object({
  figureName: z.string().min(2).max(160),
  categorySlug: z.string().min(1).max(64),
  sourceUrls: z.array(z.string().url()).max(20).optional(),
})

// AI-assisted ingest payload — the producer (`/api/v1/admin/figures/ingest`)
// only sends the `research_jobs.id`; the worker pulls the rest from the row.
const IngestPayload = z.object({
  type: z.literal('figure_ingest'),
  jobId: z.string().uuid(),
})

// ── slug: lower-case, kebab, ascii ────────────────────────────────────
function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      // strip arabic diacritics + combining marks
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 140) || `figure-${Date.now()}`
  )
}

async function loadActiveWhitelist(): Promise<{ domain: string; priority: number }[]> {
  return db
    .select({
      domain: whitelistDomains.domain,
      priority: whitelistDomains.priority,
    })
    .from(whitelistDomains)
    .where(and(eq(whitelistDomains.isActive, true), isNull(whitelistDomains.deletedAt)))
    .orderBy(asc(whitelistDomains.priority))
}

async function resolveCategoryId(slug: string): Promise<string | null> {
  const row = await db.query.figureCategories.findFirst({
    where: and(eq(figureCategories.slug, slug), isNull(figureCategories.deletedAt)),
  })
  return row?.id ?? null
}

/**
 * Pick the next reviewer round-robin via a Redis counter. Returns null when
 * no users hold the `reviewer` role — the orchestrator logs a warning and
 * leaves the draft unassigned.
 */
async function pickReviewer(): Promise<string | null> {
  const reviewerRole = await db.query.roles.findFirst({
    where: and(eq(roles.slug, 'reviewer'), isNull(roles.deletedAt)),
  })
  if (!reviewerRole) return null

  const candidates = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, reviewerRole.id))
    .orderBy(asc(userRoles.userId))
  if (candidates.length === 0) return null

  const idx = ((await redis.incr('research:reviewer:rr')) - 1) % candidates.length
  return candidates[idx]?.userId ?? candidates[0]?.userId ?? null
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * The actual research → extraction → draft-insert pipeline, factored out so
 * both job types reuse it. `figureName`, `categorySlug`, and `genderHint` come
 * from either the batch payload or the `research_jobs` row.
 */
interface RunResearchInput {
  figureName: string
  categorySlug: string
  /** Optional admin-provided hints (extra context for the LLM). */
  hints?: string | undefined
  /** Optional gender override (forced into the inserted row). */
  genderHint?: 'male' | 'female' | undefined
  /** Source URL overrides — when present, skip the whitelist search step. */
  sourceUrls?: string[] | undefined
  /** Actor that triggered the job — recorded on the draft row. */
  createdBy?: string | null
}

interface RunResearchSuccess {
  ok: true
  figureId: string
  sourcesUsed: number
  citationsInserted: number
  reviewerAssigned: boolean
}

interface RunResearchFailure {
  ok: false
  /** Machine-readable failure code (mirrors `research_jobs.error_code`). */
  code:
    | 'category_unknown'
    | 'no_sources'
    | 'extraction_empty'
    | 'rate_limited'
    | 'provider_not_configured'
    | 'internal_error'
  message: string
  /** Retry-after in milliseconds when `code === 'rate_limited'`. */
  retryAfterMs?: number
}

type RunResearchResult = RunResearchSuccess | RunResearchFailure

async function runResearch(input: RunResearchInput): Promise<RunResearchResult> {
  const log = logger.child({ route: '/api/jobs/research', figure: input.figureName })

  // ── 0. Resolve category ─────────────────────────────────────────────
  const categoryId = await resolveCategoryId(input.categorySlug)
  if (!categoryId) {
    log.warn({ slug: input.categorySlug }, 'unknown category — aborting')
    return {
      ok: false,
      code: 'category_unknown',
      message: `Kategori tidak dikenal: ${input.categorySlug}`,
    }
  }

  // ── 1. Candidate URLs ───────────────────────────────────────────────
  let candidateUrls = input.sourceUrls ?? []
  if (candidateUrls.length === 0) {
    const domains = await loadActiveWhitelist()
    candidateUrls = await searchWhitelist(input.figureName, domains)
  }
  candidateUrls = candidateUrls.slice(0, MAX_SOURCES * 2) // headroom for failures

  // ── 2. Fetch ─────────────────────────────────────────────────────────
  const fetched: { url: string; content: string }[] = []
  for (const url of candidateUrls) {
    if (fetched.length >= MAX_SOURCES) break
    try {
      const res = await fetchPage(url)
      fetched.push({ url: res.finalUrl, content: res.html })
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        log.warn({ url, retryAfterMs: err.retryAfterMs }, 'rate-limited; requeue')
        return {
          ok: false,
          code: 'rate_limited',
          message: err.message,
          retryAfterMs: err.retryAfterMs,
        }
      }
      log.warn({ url, err: (err as Error).message }, 'fetch failed; skipping source')
    }
  }

  if (fetched.length === 0) {
    log.warn(
      { figureName: input.figureName },
      'no sources fetched — whitelist returned no usable URLs',
    )
    return {
      ok: false,
      code: 'no_sources',
      message:
        'Tidak ada sumber yang dapat dikutip untuk tokoh ini. Tambahkan domain whitelist atau ubah ejaan nama.',
    }
  }

  // ── 3. LLM extract ───────────────────────────────────────────────────
  // The hint string is light-touch context for the LLM (no schema impact).
  const hintedSources = input.hints
    ? [
        ...fetched,
        {
          url: 'admin://hints',
          content: `Petunjuk admin (gunakan sebagai konteks, bukan fakta):\n${input.hints}`,
        },
      ]
    : fetched

  let extraction
  try {
    extraction = await extractFigureData(input.figureName, hintedSources)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Catch the `AIRegistryError('CONFLICT', ...)` shape from packages/ai
    // when the `agent` role has no model configured.
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'CONFLICT'
    ) {
      log.error({ err: message }, 'agent role not configured for figure_writer')
      return {
        ok: false,
        code: 'provider_not_configured',
        message:
          'Provider AI untuk role agent belum dikonfigurasi. Buka admin → AI Providers untuk mengaktifkan model.',
      }
    }
    log.error({ err: message }, 'LLM extraction threw')
    return { ok: false, code: 'internal_error', message }
  }

  const { figureData, citations: cites, modelUsed } = extraction

  // Refuse to insert a row that doesn't even have an Arabic name — that's
  // the "if sources didn't yield this figure" signal.
  if (!figureData.nameFullAr && !figureData.nameFullId) {
    log.warn(
      { figureName: input.figureName, sources: fetched.map((s) => s.url) },
      'extractor returned no name — sources likely unrelated; aborting',
    )
    return {
      ok: false,
      code: 'extraction_empty',
      message: 'Sumber yang diambil tidak cocok dengan tokoh — coba sempurnakan ejaan.',
    }
  }

  // ── 4. Insert draft + citations (Neon HTTP batch) ───────────────────
  // Neon-http does not expose `db.transaction()` — using `db.batch` keeps
  // both writes in a single round-trip.  We need the figure id before
  // building citation rows, so we do that part as a single insert first,
  // then batch the citation inserts.  Atomicity is best-effort: in the
  // unlikely event the citation batch fails, the orphan figure row will
  // be surfaced by the reviewer queue and can be cleaned up.
  const slugBase = slugify(figureData.nameFullId ?? input.figureName)
  const [row] = await db
    .insert(figures)
    .values({
      slug: `${slugBase}-${Date.now().toString(36)}`,
      categoryId,
      gender: input.genderHint ?? figureData.gender ?? 'male',
      nameFullAr: figureData.nameFullAr ?? input.figureName,
      nameFullId: figureData.nameFullId ?? input.figureName,
      kunyahAr: figureData.kunyahAr,
      kunyahId: figureData.kunyahId,
      birthDateAh: figureData.birthDateAh,
      deathDateAh: figureData.deathDateAh,
      socialCategory: figureData.socialCategory ?? null,
      specialty: figureData.specialty ?? null,
      summaryAr: figureData.summaryAr,
      summaryId: figureData.summaryId,
      biographyAr: figureData.biographyAr,
      biographyId: figureData.biographyId,
      status: 'draft',
      createdBy: input.createdBy ?? null,
    })
    .returning({ id: figures.id })

  if (!row) {
    log.error('insert figures returned no row')
    return { ok: false, code: 'internal_error', message: 'failed to insert figure draft' }
  }

  const citationInserts = cites.map((c) => ({
    contentType: 'figure',
    contentId: row.id,
    fieldPath: c.fieldPath,
    sourceUrl: c.sourceUrl,
    sourceDomain: hostOf(c.sourceUrl),
    sourceExcerptAr: c.excerptAr,
    sourceExcerptId: c.excerptId,
    sourceLang: 'ar' as const,
    modelUsed,
    extractedAt: new Date(),
  }))
  if (citationInserts.length > 0) {
    await db.insert(citations).values(citationInserts)
  }

  // ── 5. Reviewer auto-assign (best-effort) ───────────────────────────
  const reviewerId = await pickReviewer()
  if (reviewerId) {
    try {
      await db.insert(reviewAssignments).values({
        contentType: 'figure',
        contentId: row.id,
        reviewerId,
        status: 'pending',
      })
    } catch (err) {
      log.warn(
        { err: (err as Error).message, figureId: row.id },
        'failed to create review assignment',
      )
    }
  } else {
    log.warn({ figureId: row.id }, 'no reviewer available — figure left unassigned')
  }

  // ── 6. Enqueue embedding sub-job (best-effort) ──────────────────────
  const citationRows = await db
    .select({ id: citations.id })
    .from(citations)
    .where(and(eq(citations.contentId, row.id), eq(citations.contentType, 'figure')))
  const citationIds = citationRows.map((r) => r.id)
  if (citationIds.length > 0) {
    try {
      await publishJob('research/extract', { citationIds })
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'failed to enqueue extract sub-job')
    }
  }

  return {
    ok: true,
    figureId: row.id,
    sourcesUsed: fetched.length,
    citationsInserted: citationIds.length,
    reviewerAssigned: Boolean(reviewerId),
  }
}

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

  // Dispatch on the discriminator: AI ingest path vs legacy crawl path.
  const ingestParsed = IngestPayload.safeParse(json)
  if (ingestParsed.success) {
    return handleFigureIngest(ingestParsed.data.jobId)
  }

  const crawlParsed = CrawlPayload.safeParse(json)
  if (!crawlParsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'invalid research payload',
          details: crawlParsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  const payload = crawlParsed.data
  const result = await runResearch({
    figureName: payload.figureName,
    categorySlug: payload.categorySlug,
    sourceUrls: payload.sourceUrls,
  })

  if (result.ok) {
    return Response.json({
      ok: true,
      figureId: result.figureId,
      sourcesUsed: result.sourcesUsed,
      citationsInserted: result.citationsInserted,
      reviewerAssigned: result.reviewerAssigned,
    })
  }

  return failureResponse(result)
})

/**
 * AI-assisted ingest dispatcher. Reads the original input from `research_jobs`,
 * advances the row through `running → completed/failed`, and (on success)
 * writes back the new figure id so the admin UI can deep-link to the draft.
 */
async function handleFigureIngest(jobId: string): Promise<Response> {
  const log = logger.child({ route: '/api/jobs/research', jobType: 'figure_ingest', jobId })
  // 1. Load the job row.
  const job = await db.query.researchJobs.findFirst({
    where: eq(researchJobs.id, jobId),
  })
  if (!job) {
    log.warn({ jobId }, 'figure_ingest: job row not found')
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `research_jobs not found: ${jobId}` } },
      { status: 404 },
    )
  }

  // 2. Idempotency: if the job is already terminal, return its outcome.
  if (job.status === 'completed') {
    return Response.json({ ok: true, figureId: job.resultFigureId, alreadyCompleted: true })
  }
  if (job.status === 'failed') {
    return Response.json({
      ok: false,
      error: {
        code: job.errorCode ?? 'INTERNAL_ERROR',
        message: job.errorMessage ?? 'previous run failed',
      },
    })
  }

  // 3. Mark running.
  await db
    .update(researchJobs)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId))

  // 4. Coerce payload into the shape `runResearch` expects.
  const payload = job.payload as {
    name?: string
    category?: string
    gender?: 'male' | 'female'
    hints?: string
  }
  if (!payload?.name || !payload?.category) {
    const msg = 'payload missing name/category'
    await markFailed(jobId, 'internal_error', msg)
    log.error({ jobId, payload }, msg)
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: msg } },
      { status: 422 },
    )
  }

  // 5. Run the pipeline.
  let result: RunResearchResult
  try {
    result = await runResearch({
      figureName: payload.name,
      categorySlug: payload.category,
      hints: payload.hints,
      genderHint: payload.gender,
      createdBy: job.createdBy ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ jobId, err: message }, 'figure_ingest: pipeline threw')
    await markFailed(jobId, 'internal_error', message)
    return Response.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 },
    )
  }

  if (result.ok) {
    await db
      .update(researchJobs)
      .set({
        status: 'completed',
        resultFigureId: result.figureId,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(researchJobs.id, jobId))
    return Response.json({
      ok: true,
      jobId,
      figureId: result.figureId,
      sourcesUsed: result.sourcesUsed,
      citationsInserted: result.citationsInserted,
      reviewerAssigned: result.reviewerAssigned,
    })
  }

  await markFailed(jobId, result.code, result.message)
  return failureResponse(result)
}

async function markFailed(jobId: string, code: string, message: string): Promise<void> {
  await db
    .update(researchJobs)
    .set({
      status: 'failed',
      errorCode: code,
      errorMessage: message,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(researchJobs.id, jobId))
}

function failureResponse(result: RunResearchFailure): Response {
  if (result.code === 'rate_limited') {
    return Response.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: result.message } },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.ceil((result.retryAfterMs ?? 60_000) / 1000)),
        },
      },
    )
  }
  const httpStatus =
    result.code === 'category_unknown'
      ? 404
      : result.code === 'provider_not_configured'
        ? 503
        : result.code === 'internal_error'
          ? 500
          : 422
  return Response.json(
    {
      ok: false,
      error: {
        code: result.code.toUpperCase(),
        message: result.message,
      },
    },
    { status: httpStatus },
  )
}
