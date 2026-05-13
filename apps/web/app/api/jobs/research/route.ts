// Job: Deep Research per figure.
//
// Producer is either:
//   - the admin batch endpoint (`POST /api/v1/admin/research`), or
//   - a follow-up trigger from another job.
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

const ResearchPayload = z.object({
  figureName: z.string().min(2).max(160),
  categorySlug: z.string().min(1).max(64),
  sourceUrls: z.array(z.string().url()).max(20).optional(),
})

// ── slug: lower-case, kebab, ascii ────────────────────────────────────
function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      // strip arabic diacritics + combining marks
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '')
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

export const POST = withSignature(async (req) => {
  const log = logger.child({ route: '/api/jobs/research' })
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON' } },
      { status: 422 },
    )
  }

  const parsed = ResearchPayload.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'invalid research payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }
  const payload = parsed.data

  // ── 0. Resolve category ─────────────────────────────────────────────
  const categoryId = await resolveCategoryId(payload.categorySlug)
  if (!categoryId) {
    log.warn({ slug: payload.categorySlug }, 'unknown category — aborting')
    return Response.json(
      {
        ok: false,
        error: { code: 'NOT_FOUND', message: `unknown category: ${payload.categorySlug}` },
      },
      { status: 404 },
    )
  }

  // ── 1. Candidate URLs ───────────────────────────────────────────────
  let candidateUrls = payload.sourceUrls ?? []
  if (candidateUrls.length === 0) {
    const domains = await loadActiveWhitelist()
    candidateUrls = await searchWhitelist(payload.figureName, domains)
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
        // Surface a 429-ish so QStash retries with backoff later.
        log.warn({ url, retryAfterMs: err.retryAfterMs }, 'rate-limited; requeue')
        return Response.json(
          { ok: false, error: { code: 'RATE_LIMITED', message: err.message } },
          { status: 429, headers: { 'retry-after': String(Math.ceil(err.retryAfterMs / 1000)) } },
        )
      }
      log.warn({ url, err: (err as Error).message }, 'fetch failed; skipping source')
    }
  }

  if (fetched.length === 0) {
    log.warn({ figureName: payload.figureName }, 'no sources fetched — aborting')
    return Response.json(
      { ok: false, error: { code: 'NO_SOURCES', message: 'no sources could be fetched' } },
      { status: 422 },
    )
  }

  // ── 3. LLM extract ───────────────────────────────────────────────────
  const { figureData, citations: cites, modelUsed } = await extractFigureData(
    payload.figureName,
    fetched,
  )

  // Refuse to insert a row that doesn't even have an Arabic name — that's
  // the "if sources didn't yield this figure" signal.
  if (!figureData.nameFullAr && !figureData.nameFullId) {
    log.warn(
      { figureName: payload.figureName, sources: fetched.map((s) => s.url) },
      'extractor returned no name — sources likely unrelated; aborting',
    )
    return Response.json(
      { ok: false, error: { code: 'EXTRACTION_EMPTY', message: 'sources did not match figure' } },
      { status: 422 },
    )
  }

  // ── 4. Insert draft + citations (single transaction) ────────────────
  const insertedFigureId = await db.transaction(async (tx) => {
    const slug = slugify(figureData.nameFullId ?? payload.figureName)
    const [row] = await tx
      .insert(figures)
      .values({
        slug: `${slug}-${Date.now().toString(36)}`,
        categoryId,
        gender: figureData.gender ?? 'male',
        nameFullAr: figureData.nameFullAr ?? payload.figureName,
        nameFullId: figureData.nameFullId ?? payload.figureName,
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
      })
      .returning({ id: figures.id })

    if (!row) throw new Error('failed to insert figure draft')

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
      await tx.insert(citations).values(citationInserts)
    }

    return row.id
  })

  // ── 5. Reviewer auto-assign (best-effort, outside tx) ───────────────
  const reviewerId = await pickReviewer()
  if (reviewerId) {
    try {
      await db.insert(reviewAssignments).values({
        contentType: 'figure',
        contentId: insertedFigureId,
        reviewerId,
        status: 'pending',
      })
    } catch (err) {
      log.warn({ err: (err as Error).message, insertedFigureId }, 'failed to create review assignment')
    }
  } else {
    log.warn({ insertedFigureId }, 'no reviewer available — figure left unassigned')
  }

  // ── 6. Enqueue embedding sub-job (best-effort) ──────────────────────
  // Fetch the inserted citation ids so the sub-job can target them.
  const citationRows = await db
    .select({ id: citations.id })
    .from(citations)
    .where(and(eq(citations.contentId, insertedFigureId), eq(citations.contentType, 'figure')))
  const citationIds = citationRows.map((r) => r.id)
  if (citationIds.length > 0) {
    try {
      await publishJob('research/extract', { citationIds })
    } catch (err) {
      log.warn({ err: (err as Error).message }, 'failed to enqueue extract sub-job')
    }
  }

  return Response.json({
    ok: true,
    figureId: insertedFigureId,
    sourcesUsed: fetched.length,
    citationsInserted: citationIds.length,
    reviewerAssigned: Boolean(reviewerId),
  })
})
