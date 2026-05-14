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
import { and, asc, eq, ilike, isNull, or } from 'drizzle-orm'

import { db } from '@athar/db'
import {
  battleParticipants,
  battlePhases,
  battles,
  citations,
  figureCategories,
  figureLocations,
  figureRelations,
  figures,
  locations,
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
  extractBattleData,
  extractFigureData,
  fetchPage,
  RateLimitExceededError,
  searchWhitelist,
  webSearchSalafi,
  webSearchWithinWhitelist,
} from '@/lib/server/research'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const MAX_SOURCES = 5

// ─── Helpers shared by runResearch + handleFigureReIngest ───────────
//
// `fetchSources(urls)` — walks the URL list, fetches up to MAX_SOURCES
// successfully, and bubbles rate-limit errors as a sentinel value so the
// caller can shape the right top-level response (runResearch returns a
// RunResearchFailure; handleFigureReIngest writes the failed job row).
type FetchedSource = { url: string; content: string }

interface FetchSourcesResult {
  fetched: FetchedSource[]
  rateLimited: RateLimitExceededError | null
}

type JobLogger = typeof logger

async function fetchSources(
  urls: string[],
  log: JobLogger,
  label: string,
): Promise<FetchSourcesResult> {
  const fetched: FetchedSource[] = []
  for (const url of urls) {
    if (fetched.length >= MAX_SOURCES) break
    try {
      const res = await fetchPage(url)
      fetched.push({ url: res.finalUrl, content: res.html })
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        log.warn(
          { url, retryAfterMs: err.retryAfterMs, label },
          'rate-limited; requeue',
        )
        return { fetched, rateLimited: err }
      }
      log.warn(
        { url, err: (err as Error).message, label },
        'fetch failed; skipping source',
      )
    }
  }
  return { fetched, rateLimited: null }
}

// `tryExtractFigure(...)` — run the LLM extractor and shape errors into a
// RunResearchFailure so callers can return it verbatim. Wrapped in a union
// type so success vs failure is structurally distinct.
type ExtractFigureAttempt =
  | { result: Awaited<ReturnType<typeof extractFigureData>> }
  | { failure: RunResearchFailure }

// One fallback-tier: fetch candidate URLs, extract, accept the attempt
// only if the AI produced a usable name. Returns a tagged union so
// callers can propagate rate-limit / provider-error responses verbatim.
type ExtractSuccess = { result: Awaited<ReturnType<typeof extractFigureData>> }
type FallbackTierResult =
  | { kind: 'accepted'; fetched: FetchedSource[]; attempt: ExtractSuccess }
  | { kind: 'rate_limited'; err: RateLimitExceededError }
  | { kind: 'failure'; failure: RunResearchFailure }
  | { kind: 'no_match' }

/**
 * Does this figure-extraction look substantive enough to keep, or should we
 * fall back to DDG? "Substantive" = at least one of the rich narrative
 * fields OR multiple non-name fields populated. AI echoing the input name
 * back while writing null everywhere else is NOT substantive — that's the
 * failure mode we saw on Abbas bin Abdul Muthalib (5 source pages were
 * whitelist on-site search-result pages → AI correctly refused to invent
 * biography → output was "name + nothing"). We treat that as a miss so
 * the DDG ladder kicks in.
 */
function extractionLooksSubstantive(
  data: Awaited<ReturnType<typeof extractFigureData>>['figureData'],
): boolean {
  // Reject extractions with no name at all — sources were irrelevant.
  if (!data.nameFullAr && !data.nameFullId) return false
  // Strong signal: any long-form narrative field has content.
  if (
    (data.biographyAr && data.biographyAr.trim().length > 80) ||
    (data.biographyId && data.biographyId.trim().length > 80) ||
    (data.biographyPreWafatId && data.biographyPreWafatId.trim().length > 40) ||
    (data.biographyPostWafatId && data.biographyPostWafatId.trim().length > 40) ||
    (data.summaryId && data.summaryId.trim().length > 40) ||
    (data.summaryAr && data.summaryAr.trim().length > 40)
  ) {
    return true
  }
  // Weaker signal: count populated non-name fields. >= 3 means AI found
  // SOMETHING (dates, specialty, kunyah, madhab, etc.) — accept.
  let populated = 0
  if (data.birthDateAh || data.birthDateCe) populated++
  if (data.deathDateAh || data.deathDateCe) populated++
  if (data.kunyahAr || data.kunyahId) populated++
  if (data.laqabAr || data.laqabId) populated++
  if (data.madhab) populated++
  if (data.rijalGrade && data.rijalGrade !== 'unverified') populated++
  if (data.specialty && data.specialty.length > 0) populated++
  if (data.socialCategory && data.socialCategory.length > 0) populated++
  if (data.hadithCountMin || data.hadithCountMax) populated++
  if (data.deathCause) populated++
  return populated >= 3
}

async function tryFallbackTier(
  name: string,
  urls: string[],
  hints: string | undefined,
  log: JobLogger,
  label: string,
): Promise<FallbackTierResult> {
  if (urls.length === 0) return { kind: 'no_match' }
  const fetch = await fetchSources(urls, log, label)
  if (fetch.rateLimited) return { kind: 'rate_limited', err: fetch.rateLimited }
  if (fetch.fetched.length === 0) return { kind: 'no_match' }
  const attempt = await tryExtractFigure(name, fetch.fetched, hints, log)
  if (!attempt) return { kind: 'no_match' }
  if ('failure' in attempt) return { kind: 'failure', failure: attempt.failure }
  // Same substantive check as the initial pass — don't accept a "name only"
  // extraction from the fallback tier either, or we'd just be passing the
  // same junk through.
  if (extractionLooksSubstantive(attempt.result.figureData)) {
    return { kind: 'accepted', fetched: fetch.fetched, attempt }
  }
  return { kind: 'no_match' }
}

// Battle-equivalent of `tryFallbackTier` / `tryExtractFigure` — the figure
// helpers can't be reused because they call `extractFigureData` and check
// `nameFullAr/Id`. Battles use `extractBattleData` and check `nameAr/nameId`.
type ExtractBattleAttempt =
  | { result: Awaited<ReturnType<typeof extractBattleData>> }
  | { failure: BattleExtractionFailure }

interface BattleExtractionFailure {
  code: 'provider_not_configured' | 'internal_error'
  message: string
}

type BattleSuccess = { result: Awaited<ReturnType<typeof extractBattleData>> }
type BattleFallbackTierResult =
  | { kind: 'accepted'; fetched: FetchedSource[]; attempt: BattleSuccess }
  | { kind: 'rate_limited'; err: RateLimitExceededError }
  | { kind: 'failure'; failure: BattleExtractionFailure }
  | { kind: 'no_match' }

async function tryExtractBattle(
  name: string,
  sources: FetchedSource[],
  hints: string | undefined,
  log: JobLogger,
): Promise<ExtractBattleAttempt | null> {
  if (sources.length === 0) return null
  try {
    const result = await extractBattleData(name, sources, hints)
    return { result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'CONFLICT'
    ) {
      log.error({ err: message }, 'agent role not configured for battle extractor')
      return {
        failure: {
          code: 'provider_not_configured',
          message:
            'Provider AI untuk role agent belum dikonfigurasi. Buka admin → AI Providers untuk mengaktifkan model.',
        },
      }
    }
    log.error({ err: message }, 'LLM battle extraction threw')
    return { failure: { code: 'internal_error', message } }
  }
}

/** Battle analogue of `extractionLooksSubstantive`. Same logic: require
 *  either a real narrative or several non-name fields populated, so that
 *  "AI echoed input battle name + null everything else" triggers fallback
 *  instead of silently completing as a no-op. */
function battleExtractionLooksSubstantive(
  data: Awaited<ReturnType<typeof extractBattleData>>['battleData'],
): boolean {
  const nameAr = data.nameAr?.trim() ?? ''
  const nameId = data.nameId?.trim() ?? ''
  if (nameAr.length === 0 && nameId.length === 0) return false
  if (
    (data.narrativeId && data.narrativeId.trim().length > 120) ||
    (data.narrativeAr && data.narrativeAr.trim().length > 120) ||
    (data.strategyId && data.strategyId.trim().length > 80) ||
    (data.strategyAr && data.strategyAr.trim().length > 80) ||
    (data.significanceId && data.significanceId.trim().length > 60) ||
    (data.significanceAr && data.significanceAr.trim().length > 60)
  ) {
    return true
  }
  let populated = 0
  if (data.eventDateAh || data.eventDateCe) populated++
  if (data.commanderName) populated++
  if (data.locationSlug) populated++
  if (data.opponentForce) populated++
  if (data.muslimCount || data.opponentCount) populated++
  if (data.casualtiesMuslim || data.casualtiesOpponent) populated++
  if (data.outcome) populated++
  if (data.participants && data.participants.length > 0) populated++
  if (data.phases && data.phases.length > 0) populated++
  return populated >= 3
}

async function tryFallbackTierBattle(
  name: string,
  urls: string[],
  hints: string | undefined,
  log: JobLogger,
  label: string,
): Promise<BattleFallbackTierResult> {
  if (urls.length === 0) return { kind: 'no_match' }
  const fetch = await fetchSources(urls, log, label)
  if (fetch.rateLimited) return { kind: 'rate_limited', err: fetch.rateLimited }
  if (fetch.fetched.length === 0) return { kind: 'no_match' }
  const attempt = await tryExtractBattle(name, fetch.fetched, hints, log)
  if (!attempt) return { kind: 'no_match' }
  if ('failure' in attempt) return { kind: 'failure', failure: attempt.failure }
  if (battleExtractionLooksSubstantive(attempt.result.battleData)) {
    return { kind: 'accepted', fetched: fetch.fetched, attempt }
  }
  return { kind: 'no_match' }
}

async function tryExtractFigure(
  name: string,
  sources: FetchedSource[],
  hints: string | undefined,
  log: JobLogger,
): Promise<ExtractFigureAttempt | null> {
  if (sources.length === 0) return null
  try {
    // Hints are forwarded via the `hints` argument so they end up in the
    // user-prompt body (extract.ts:buildUserPrompt) — NOT as a fake source
    // with `url: 'admin://hints'`. The non-http scheme would otherwise leak
    // into citations and confuse the model.
    const result = await extractFigureData(name, sources, hints)
    return { result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'CONFLICT'
    ) {
      log.error({ err: message }, 'agent role not configured for figure_writer')
      return {
        failure: {
          ok: false,
          code: 'provider_not_configured',
          message:
            'Provider AI untuk role agent belum dikonfigurasi. Buka admin → AI Providers untuk mengaktifkan model.',
        },
      }
    }
    log.error({ err: message }, 'LLM extraction threw')
    return { failure: { ok: false, code: 'internal_error', message } }
  }
}

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

// Re-ingest payload — refresh an EXISTING figure. Same row-by-jobId
// indirection as the ingest path so the worker can be retried by QStash
// without the producer holding state.
const ReIngestPayload = z.object({
  type: z.literal('figure_reingest'),
  jobId: z.string().uuid(),
})

// Battle ingest payload — producer (`/api/v1/admin/battles/ingest`) only
// sends the `research_jobs.id`; the worker pulls the rest from the row.
const BattleIngestPayload = z.object({
  type: z.literal('battle_ingest'),
  jobId: z.string().uuid(),
})

// Battle re-ingest payload — refresh an EXISTING battle row.
const BattleReIngestPayload = z.object({
  type: z.literal('battle_reingest'),
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

  // ── 1. Try whitelist sources first (preferred — vetted domains). ────
  //    `whitelistDomainList` is loaded eagerly so the DDG fallback below
  //    has access to it even when the caller supplied explicit sourceUrls.
  const whitelistDomainList = await loadActiveWhitelist()
  let candidateUrls = input.sourceUrls ?? []
  if (candidateUrls.length === 0) {
    candidateUrls = await searchWhitelist(input.figureName, whitelistDomainList)
  }
  candidateUrls = candidateUrls.slice(0, MAX_SOURCES * 2)

  const fetchAttempt = await fetchSources(candidateUrls, log, 'whitelist')
  if (fetchAttempt.rateLimited) {
    return {
      ok: false,
      code: 'rate_limited',
      message: fetchAttempt.rateLimited.message,
      retryAfterMs: fetchAttempt.rateLimited.retryAfterMs,
    }
  }

  let fetched = fetchAttempt.fetched
  let extraction: ExtractSuccess | null = null
  if (fetched.length > 0) {
    const initial = await tryExtractFigure(
      input.figureName,
      fetched,
      input.hints,
      log,
    )
    if (initial && 'failure' in initial) return initial.failure
    if (initial) extraction = initial
  }

  // ── 2. Fallback ladder ───────────────────────────────────────────────
  //
  //   Tier A — DDG search restricted to whitelist domains via `site:` OR.
  //            Best signal: same trusted source set as the direct
  //            whitelist URL builder, but DDG hands us the real article URL
  //            instead of the noisy on-site search page.
  //   Tier B — broader DDG search with "biografi salaf" suffix. Used only
  //            when tier A returns nothing — covers figures whose biography
  //            lives on non-whitelist (but still salaf-leaning) sites.
  // Fallback trigger: any of
  //   (a) extraction never ran (no sources fetched).
  //   (b) AI returned null nameFullAr/nameFullId (sources irrelevant to
  //       this figure).
  //   (c) AI returned a name but NOTHING substantive — no biography, no
  //       summary, no dates, no specialty. This catches the
  //       "whitelist search page → 5 sources → AI echoes back input
  //       name but writes null everywhere because the pages were just
  //       navbar+sidebar" failure mode that left `suggestions: {}` on
  //       Abbas bin Abdul Muthalib and similar figures.
  const needsFallback =
    !extraction ||
    !extractionLooksSubstantive(extraction.result.figureData)
  if (needsFallback) {
    const topDomains = [...whitelistDomainList]
      .sort((a, b) => b.priority - a.priority)
      .map((d) => d.domain)

    log.warn(
      { figureName: input.figureName },
      'whitelist path yielded no usable extraction — tier A: DDG within whitelist',
    )
    const tierAUrls = await webSearchWithinWhitelist(input.figureName, topDomains, {
      limit: MAX_SOURCES * 2,
    })
    const tierA = await tryFallbackTier(
      input.figureName,
      tierAUrls,
      input.hints,
      log,
      'ddg-within-whitelist',
    )
    if (tierA.kind === 'rate_limited') {
      return {
        ok: false,
        code: 'rate_limited',
        message: tierA.err.message,
        retryAfterMs: tierA.err.retryAfterMs,
      }
    }
    if (tierA.kind === 'failure') return tierA.failure
    if (tierA.kind === 'accepted') {
      fetched = tierA.fetched
      extraction = tierA.attempt
    } else {
      log.warn(
        { figureName: input.figureName },
        'tier A yielded nothing — tier B: broader DDG salaf search',
      )
      const tierBUrls = await webSearchSalafi(input.figureName, {
        limit: MAX_SOURCES * 2,
      })
      const tierB = await tryFallbackTier(
        input.figureName,
        tierBUrls,
        input.hints,
        log,
        'ddg-salaf',
      )
      if (tierB.kind === 'rate_limited') {
        return {
          ok: false,
          code: 'rate_limited',
          message: tierB.err.message,
          retryAfterMs: tierB.err.retryAfterMs,
        }
      }
      if (tierB.kind === 'failure') return tierB.failure
      if (tierB.kind === 'accepted') {
        fetched = tierB.fetched
        extraction = tierB.attempt
      }
    }
  }

  if (!extraction) {
    return {
      ok: false,
      code: 'no_sources',
      message:
        'Tidak ada sumber yang dapat dikutip untuk tokoh ini. Tambahkan domain whitelist atau ubah ejaan nama.',
    }
  }

  const { figureData, citations: cites, nasabChain, modelUsed } = extraction.result

  if (!figureData.nameFullAr && !figureData.nameFullId) {
    log.warn(
      { figureName: input.figureName, sources: fetched.map((s) => s.url) },
      'extractor returned no name even after DDG fallback — aborting',
    )
    return {
      ok: false,
      code: 'extraction_empty',
      message: 'Sumber yang diambil tidak cocok dengan tokoh — coba sempurnakan ejaan.',
    }
  }

  // Anti-hallucination guard: if the AI produced biography/summary content
  // but didn't cite any source, treat the extraction as ungrounded and bail
  // so we don't persist a fabricated draft.
  const hasBodyText = Boolean(
    figureData.biographyAr ||
      figureData.biographyId ||
      figureData.summaryAr ||
      figureData.summaryId,
  )
  if (hasBodyText && cites.length === 0) {
    log.warn(
      { figureName: input.figureName },
      'extractor produced body text without citations — likely hallucination',
    )
    return {
      ok: false,
      code: 'extraction_empty',
      message:
        'AI menulis biografi tanpa kutipan sumber — kemungkinan halusinasi. Coba ulangi.',
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

  // Resolve single-FK location columns from extracted names. Best-effort —
  // unresolved names land as null on the row; admin can fill manually.
  const locationFkPatch = await resolveSingleLocationFields(
    figureData.primaryLocationName,
    figureData.deathLocationName,
    figureData.burialLocationName,
    log,
  )

  const [row] = await db
    .insert(figures)
    .values({
      slug: `${slugBase}-${Date.now().toString(36)}`,
      categoryId,
      gender: input.genderHint ?? figureData.gender ?? 'male',
      nameFullAr: figureData.nameFullAr ?? input.figureName,
      nameFullId: figureData.nameFullId ?? input.figureName,
      nameShortAr: figureData.nameShortAr,
      nameShortId: figureData.nameShortId,
      kunyahAr: figureData.kunyahAr,
      kunyahId: figureData.kunyahId,
      laqabAr: figureData.laqabAr,
      laqabId: figureData.laqabId,
      birthDateAh: figureData.birthDateAh,
      birthDateCe: figureData.birthDateCe,
      deathDateAh: figureData.deathDateAh,
      deathDateCe: figureData.deathDateCe,
      deathCause: figureData.deathCause,
      socialCategory: figureData.socialCategory ?? null,
      specialty: figureData.specialty ?? null,
      madhab: figureData.madhab,
      rijalGrade: figureData.rijalGrade ?? 'unverified',
      rijalNotesAr: figureData.rijalNotesAr,
      rijalNotesId: figureData.rijalNotesId,
      hadithCountMin: figureData.hadithCountMin,
      hadithCountMax: figureData.hadithCountMax,
      summaryAr: figureData.summaryAr,
      summaryId: figureData.summaryId,
      biographyAr: figureData.biographyAr,
      biographyId: figureData.biographyId,
      biographyPreWafatAr: figureData.biographyPreWafatAr,
      biographyPreWafatId: figureData.biographyPreWafatId,
      biographyPostWafatAr: figureData.biographyPostWafatAr,
      biographyPostWafatId: figureData.biographyPostWafatId,
      primaryLocationId: locationFkPatch.primaryLocationId ?? null,
      deathLocationId: locationFkPatch.deathLocationId ?? null,
      burialLocationId: locationFkPatch.burialLocationId ?? null,
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
    // Idempotent against the (content_type, content_id, source_url,
    // COALESCE(field_path, '')) partial unique index — re-runs collapse
    // onto the same row instead of spamming the Sumber tab.
    await db.insert(citations).values(citationInserts).onConflictDoNothing()
  }

  // ── 4b. Nasab chain — INSERT figure_relations rows ──────────────────
  //
  // The chain is ordered child → parent → grandparent. We walk the list
  // pairwise (child = previous link, parent = current link) and INSERT
  // `relation_type='father'` rows of the form (figureId=parent, relatedId=child)
  // matching the convention in seeders/027_relations.ts.
  //
  // Many ancestors won't exist as `figures` rows (Adnan, Qushayy, …). The
  // `figure_relations` FK requires both ends to be real figures, so we
  // upsert minimal `shalih_pre_rasul` figure rows for the missing ones
  // (status='draft' so editorial can curate them).
  if (nasabChain.length > 0) {
    try {
      await insertNasabChain({
        seedFigureId: row.id,
        seedFigureName: figureData.nameFullId ?? input.figureName,
        chain: nasabChain,
        createdBy: input.createdBy ?? null,
        log,
      })
    } catch (err) {
      log.warn(
        { err: (err as Error).message, figureId: row.id },
        'nasab chain insert failed (non-fatal)',
      )
    }
  }

  // ── 4c. figure_locations rows from AI's `figureLocations[]` ─────────
  try {
    await insertFigureLocations(row.id, figureData.figureLocations ?? [], log)
  } catch (err) {
    log.warn(
      { err: (err as Error).message, figureId: row.id },
      'figureLocations insert failed (non-fatal)',
    )
  }

  // ── 4d. figure_relations rows from AI's `relations[]` ───────────────
  try {
    await insertFigureRelations(row.id, figureData.relations ?? [], log)
  } catch (err) {
    log.warn(
      { err: (err as Error).message, figureId: row.id },
      'figureRelations insert failed (non-fatal)',
    )
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

  // Dispatch on the discriminator: AI ingest path, re-ingest path, or
  // legacy crawl path. Order matters — re-ingest carries its own `type`
  // tag so it's checked before the type-less crawl fallback.
  const ingestParsed = IngestPayload.safeParse(json)
  if (ingestParsed.success) {
    return handleFigureIngest(ingestParsed.data.jobId)
  }

  const reIngestParsed = ReIngestPayload.safeParse(json)
  if (reIngestParsed.success) {
    return handleFigureReIngest(reIngestParsed.data.jobId)
  }

  const battleIngestParsed = BattleIngestPayload.safeParse(json)
  if (battleIngestParsed.success) {
    return handleBattleIngest(battleIngestParsed.data.jobId)
  }

  const battleReIngestParsed = BattleReIngestPayload.safeParse(json)
  if (battleReIngestParsed.success) {
    return handleBattleReIngest(battleReIngestParsed.data.jobId)
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

// ── figure_reingest ────────────────────────────────────────────────────
//
// Refresh an EXISTING figure row. Workflow:
//   1. Load `research_jobs` row → set status=running.
//   2. Load current figure record by `payload.figureId`.
//   3. Build a fresh AI extraction via the same `searchWhitelist → fetchPage
//      → extractFigureData` pipeline used for the ingest path.
//   4. Merge AI output into the figure row per `mode`:
//        - 'enrich' (default): only fill fields currently null/empty.
//        - 'replace': overwrite the columns named in `focusFields` (and
//          nothing else — all other fields are left untouched).
//   5. INSERT new citations rows; never DELETE old ones (the old sources
//      might still be valid for unchanged fields).
//   6. UPDATE research_jobs status=completed, result_figure_id=figureId,
//      metadata.fieldsChanged=[…] so the admin UI can highlight the diff.

const MERGEABLE_FIELDS = [
  'nameFullAr',
  'nameFullId',
  'nameShortAr',
  'nameShortId',
  'kunyahAr',
  'kunyahId',
  'laqabAr',
  'laqabId',
  'birthDateAh',
  'birthDateCe',
  'deathDateAh',
  'deathDateCe',
  'deathCause',
  'gender',
  'socialCategory',
  'specialty',
  'madhab',
  'rijalGrade',
  'rijalNotesAr',
  'rijalNotesId',
  'hadithCountMin',
  'hadithCountMax',
  'summaryAr',
  'summaryId',
  'biographyAr',
  'biographyId',
  'biographyPreWafatAr',
  'biographyPreWafatId',
  'biographyPostWafatAr',
  'biographyPostWafatId',
] as const

type MergeableField = (typeof MERGEABLE_FIELDS)[number]

/** Treat null, empty string, and empty array as "missing" for enrich mode. */
function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

/** Loose equality for diff capture — handles string trim, array order-sensitive
 *  compare, and treats null/undefined/'' interchangeably. */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (isEmptyValue(a) && isEmptyValue(b)) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim()
  return a === b
}

async function handleFigureReIngest(jobId: string): Promise<Response> {
  const log = logger.child({
    route: '/api/jobs/research',
    jobType: 'figure_reingest',
    jobId,
  })

  // 1. Load the job row.
  const job = await db.query.researchJobs.findFirst({
    where: eq(researchJobs.id, jobId),
  })
  if (!job) {
    log.warn({ jobId }, 'figure_reingest: job row not found')
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `research_jobs not found: ${jobId}` } },
      { status: 404 },
    )
  }

  // 2. Idempotency: terminal states are short-circuited.
  if (job.status === 'completed') {
    return Response.json({
      ok: true,
      figureId: job.resultFigureId,
      alreadyCompleted: true,
    })
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

  // 4. Coerce payload. The producer (re-ingest endpoint) writes this shape;
  //    we re-validate defensively because nothing stops a future migration
  //    from changing the format.
  const payload = job.payload as {
    figureId?: string
    slug?: string
    name?: string
    categorySlug?: string
    mode?: 'enrich' | 'replace'
    focusFields?: MergeableField[]
    hints?: string
    originalSnapshot?: Record<string, unknown>
  } | null

  if (!payload?.figureId || !payload?.name || !payload?.categorySlug) {
    const msg = 'payload missing figureId/name/categorySlug'
    await markFailed(jobId, 'internal_error', msg)
    log.error({ jobId, payload }, msg)
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: msg } },
      { status: 422 },
    )
  }

  // 5. Load the current figure row. It may have been soft-deleted between
  //    the request and the worker pickup — we treat that as a no-op.
  const currentFigure = await db.query.figures.findFirst({
    where: and(eq(figures.id, payload.figureId), isNull(figures.deletedAt)),
  })
  if (!currentFigure) {
    const msg = `Figure not found or deleted: ${payload.figureId}`
    await markFailed(jobId, 'not_found', msg)
    log.warn({ jobId, figureId: payload.figureId }, 'figure_reingest: figure missing')
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND', message: msg } },
      { status: 404 },
    )
  }

  // 6. Run the AI extraction. We deliberately DO NOT reuse `runResearch`
  //    because that helper INSERTs a new draft row. The re-ingest path only
  //    UPDATEs the existing row.
  //
  //    Whitelist first; if extraction yields no name (sources irrelevant)
  //    we fall back to DuckDuckGo HTML with a `biografi salaf` suffix so the
  //    pipeline still has something to extract from.
  const domains = await loadActiveWhitelist()
  let candidateUrls = await searchWhitelist(payload.name, domains)
  candidateUrls = candidateUrls.slice(0, MAX_SOURCES * 2)

  // Compose the focus-field hint once; used for both attempts.
  const focusList = payload.focusFields ?? []
  const hintParts: string[] = []
  if (payload.hints) hintParts.push(payload.hints)
  if (focusList.length > 0) {
    hintParts.push(
      `Fokuskan ekstraksi pada kolom berikut: ${focusList.join(', ')}.`,
    )
  }
  const combinedHints = hintParts.length > 0 ? hintParts.join('\n') : undefined

  const whitelistFetch = await fetchSources(candidateUrls, log, 'whitelist')
  if (whitelistFetch.rateLimited) {
    await markFailed(jobId, 'rate_limited', whitelistFetch.rateLimited.message)
    return Response.json(
      {
        ok: false,
        error: { code: 'RATE_LIMITED', message: whitelistFetch.rateLimited.message },
      },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.ceil(whitelistFetch.rateLimited.retryAfterMs / 1000)),
        },
      },
    )
  }

  let fetched = whitelistFetch.fetched
  let extractionAttempt: ExtractSuccess | null = null
  if (fetched.length > 0) {
    const initial = await tryExtractFigure(payload.name, fetched, combinedHints, log)
    if (initial && 'failure' in initial) {
      const failure = initial.failure
      if (failure.code === 'provider_not_configured') {
        await markFailed(jobId, 'provider_not_configured', failure.message)
        return Response.json(
          { ok: false, error: { code: 'PROVIDER_NOT_CONFIGURED', message: failure.message } },
          { status: 503 },
        )
      }
      await markFailed(jobId, 'internal_error', failure.message)
      return Response.json(
        { ok: false, error: { code: 'INTERNAL_ERROR', message: failure.message } },
        { status: 500 },
      )
    }
    if (initial) extractionAttempt = initial
  }

  // Mirror runResearch — also fall back when AI echoed a name but wrote
  // null for every substantive field (the "search-result-page-as-source"
  // failure mode). See the matching comment above runResearch.
  const needsFallback =
    !extractionAttempt ||
    !extractionLooksSubstantive(extractionAttempt.result.figureData)
  if (needsFallback) {
    const topDomains = [...domains]
      .sort((a, b) => b.priority - a.priority)
      .map((d) => d.domain)

    log.warn(
      { jobId, name: payload.name },
      'whitelist path yielded no usable extraction — tier A: DDG within whitelist',
    )
    const tierAUrls = await webSearchWithinWhitelist(payload.name, topDomains, {
      limit: MAX_SOURCES * 2,
    })
    const tierA = await tryFallbackTier(
      payload.name,
      tierAUrls,
      combinedHints,
      log,
      'ddg-within-whitelist',
    )
    const handleFallback = async (
      tier: FallbackTierResult,
    ): Promise<Response | { applied: true } | { applied: false }> => {
      if (tier.kind === 'rate_limited') {
        await markFailed(jobId, 'rate_limited', tier.err.message)
        return Response.json(
          {
            ok: false,
            error: { code: 'RATE_LIMITED', message: tier.err.message },
          },
          {
            status: 429,
            headers: {
              'retry-after': String(Math.ceil(tier.err.retryAfterMs / 1000)),
            },
          },
        )
      }
      if (tier.kind === 'failure') {
        const failure = tier.failure
        if (failure.code === 'provider_not_configured') {
          await markFailed(jobId, 'provider_not_configured', failure.message)
          return Response.json(
            { ok: false, error: { code: 'PROVIDER_NOT_CONFIGURED', message: failure.message } },
            { status: 503 },
          )
        }
        await markFailed(jobId, 'internal_error', failure.message)
        return Response.json(
          { ok: false, error: { code: 'INTERNAL_ERROR', message: failure.message } },
          { status: 500 },
        )
      }
      if (tier.kind === 'accepted') {
        fetched = tier.fetched
        extractionAttempt = tier.attempt
        return { applied: true }
      }
      return { applied: false }
    }

    const aOutcome = await handleFallback(tierA)
    if (aOutcome instanceof Response) return aOutcome
    if (!aOutcome.applied) {
      log.warn(
        { jobId, name: payload.name },
        'tier A yielded nothing — tier B: broader DDG salaf search',
      )
      const tierBUrls = await webSearchSalafi(payload.name, { limit: MAX_SOURCES * 2 })
      const tierB = await tryFallbackTier(
        payload.name,
        tierBUrls,
        combinedHints,
        log,
        'ddg-salaf',
      )
      const bOutcome = await handleFallback(tierB)
      if (bOutcome instanceof Response) return bOutcome
    }
  }

  if (!extractionAttempt) {
    const msg =
      'Tidak ada sumber yang dapat dikutip untuk tokoh ini. Tambahkan domain whitelist atau ubah ejaan nama.'
    await markFailed(jobId, 'no_sources', msg)
    return Response.json(
      { ok: false, error: { code: 'NO_SOURCES', message: msg } },
      { status: 422 },
    )
  }

  const { figureData, citations: cites, modelUsed } = extractionAttempt.result

  // Anti-hallucination guard: refuse to persist body text without
  // citations. Symmetric with the same check in `runResearch`.
  const hasBodyText = Boolean(
    figureData.biographyAr ||
      figureData.biographyId ||
      figureData.summaryAr ||
      figureData.summaryId,
  )
  if (hasBodyText && cites.length === 0) {
    const msg =
      'AI menulis biografi tanpa kutipan sumber — kemungkinan halusinasi. Coba ulangi.'
    log.warn(
      { jobId, figureId: payload.figureId },
      'figure reingest produced body text without citations — aborting',
    )
    await markFailed(jobId, 'extraction_empty', msg)
    return Response.json(
      { ok: false, error: { code: 'EXTRACTION_EMPTY', message: msg } },
      { status: 422 },
    )
  }

  // 7. Build the per-mode merge patch.
  const mode: 'enrich' | 'replace' = payload.mode ?? 'enrich'
  // In replace mode an admin must specify which fields to overwrite (empty
  // focusFields would replace everything — that's create-from-scratch, not
  // a refresh). Default to "no-op" when focusFields is empty rather than
  // wiping the row.
  const replaceFields: Set<MergeableField> = new Set(
    mode === 'replace' ? (payload.focusFields ?? []) : [],
  )

  const fieldsChanged: MergeableField[] = []
  // Drizzle's `set()` is column-typed — we accumulate the patch under the
  // table's inferred-insert type to keep type safety end-to-end.
  type FigureUpdate = Partial<typeof figures.$inferInsert>
  const patch: FigureUpdate = {}
  // `suggestions` mirrors `patch` but typed as a JSON record so the
  // admin re-ingest UI can render diff rows (current vs proposed) and
  // "Tolak" can rollback using `previous`.
  const suggestions: Record<string, unknown> = {}
  const previous: Record<string, unknown> = {}

  for (const field of MERGEABLE_FIELDS) {
    const aiValue = figureData[field as keyof typeof figureData] as unknown
    if (isEmptyValue(aiValue)) continue
    const currentValue = currentFigure[field] as unknown

    // Always surface AI's proposal in `suggestions` if it differs from the
    // current value — this drives the "Tinjau diff" dialog. Auto-apply is a
    // separate, more conservative gate handled by `patch` below. Decoupling
    // the two means an admin in `enrich` mode can still review (and manually
    // accept) AI's alternative for a field that's already filled.
    if (!valuesEqual(aiValue, currentValue)) {
      suggestions[field] = aiValue
      previous[field] = currentValue
    }

    if (mode === 'enrich') {
      // Auto-fill only if the current row has nothing.
      if (!isEmptyValue(currentValue)) continue
    } else {
      // replace mode — only the explicitly-named fields are touched.
      if (!replaceFields.has(field)) continue
    }
    // Safe assignment: every field in MERGEABLE_FIELDS is a known column on
    // `figures` and `aiValue` matches the column type because
    // `FigureExtractionSchema` (extract.ts) was built from the same schema.
    ;(patch as Record<string, unknown>)[field] = aiValue
    fieldsChanged.push(field)
  }

  // 7b. Resolve single-FK location columns from AI's extracted names. In
  //     enrich mode we only set IDs that are currently null; in replace mode
  //     we honour them only if 'primary'/'death'/'burial' is in focusFields
  //     (admin opted in). Surface as suggestions even when not auto-applied.
  const locationFkPatch = await resolveSingleLocationFields(
    figureData.primaryLocationName,
    figureData.deathLocationName,
    figureData.burialLocationName,
    log,
  )
  if (locationFkPatch.primaryLocationId && !currentFigure.primaryLocationId) {
    ;(patch as Record<string, unknown>).primaryLocationId = locationFkPatch.primaryLocationId
    suggestions['primaryLocationId'] = locationFkPatch.primaryLocationId
    previous['primaryLocationId'] = currentFigure.primaryLocationId
  }
  if (locationFkPatch.deathLocationId && !currentFigure.deathLocationId) {
    ;(patch as Record<string, unknown>).deathLocationId = locationFkPatch.deathLocationId
    suggestions['deathLocationId'] = locationFkPatch.deathLocationId
    previous['deathLocationId'] = currentFigure.deathLocationId
  }
  if (locationFkPatch.burialLocationId && !currentFigure.burialLocationId) {
    ;(patch as Record<string, unknown>).burialLocationId = locationFkPatch.burialLocationId
    suggestions['burialLocationId'] = locationFkPatch.burialLocationId
    previous['burialLocationId'] = currentFigure.burialLocationId
  }

  // 8. UPDATE the figure row only if we actually have something to change.
  if (Object.keys(patch).length > 0) {
    await db
      .update(figures)
      .set({
        ...patch,
        updatedAt: new Date(),
        // Preserve the original creator; just bump updatedBy to the job
        // initiator so the audit log shows "refreshed by admin X".
        ...(job.createdBy ? { updatedBy: job.createdBy } : {}),
      })
      .where(eq(figures.id, currentFigure.id))
  }

  // 8b. Insert figure_locations rows from AI's `figureLocations[]`. Best
  //     effort — onConflictDoNothing makes re-ingest idempotent.
  try {
    await insertFigureLocations(
      currentFigure.id,
      figureData.figureLocations ?? [],
      log,
    )
  } catch (err) {
    log.warn(
      { err: (err as Error).message, figureId: currentFigure.id },
      'figureLocations insert failed (non-fatal)',
    )
  }

  // 8c. Insert figure_relations rows from AI's `relations[]`. Missing
  //     targets are skipped + logged so admin can wire them manually.
  try {
    await insertFigureRelations(
      currentFigure.id,
      figureData.relations ?? [],
      log,
    )
  } catch (err) {
    log.warn(
      { err: (err as Error).message, figureId: currentFigure.id },
      'figureRelations insert failed (non-fatal)',
    )
  }

  // 9. INSERT new citations. We never DELETE the old citations — they may
  //    still back fields we didn't touch. The admin can prune stale citations
  //    from the Sumber tab on the figure detail page if needed.
  const citationInserts = cites.map((c) => ({
    contentType: 'figure',
    contentId: currentFigure.id,
    fieldPath: c.fieldPath,
    sourceUrl: c.sourceUrl,
    sourceDomain: hostOf(c.sourceUrl),
    sourceExcerptAr: c.excerptAr,
    sourceExcerptId: c.excerptId,
    sourceLang: 'ar' as const,
    modelUsed,
    extractedAt: new Date(),
  }))
  let insertedCitationCount = 0
  if (citationInserts.length > 0) {
    // Idempotent against `citations_unique_active_idx` — re-running
    // re-ingest no longer spams duplicates.
    const inserted = await db
      .insert(citations)
      .values(citationInserts)
      .onConflictDoNothing()
      .returning({ id: citations.id })
    insertedCitationCount = inserted.length
  }

  // 10. Mark the job complete. We stash three blobs in payload so the
  //     re-ingest diff dialog can render properly:
  //       - fieldsChanged: array of field names that were mutated.
  //       - suggestions: { field → AI-applied value } (for "Tinjau diff").
  //       - previous: { field → pre-refresh value } (for "Tolak / revert").
  const updatedPayload = {
    ...(payload as Record<string, unknown>),
    metadata: {
      mode,
      sourcesUsed: fetched.length,
      fieldsChanged,
      citationsInserted: insertedCitationCount,
      modelUsed,
    },
    suggestions,
    previous,
  }
  await db
    .update(researchJobs)
    .set({
      status: 'completed',
      resultFigureId: currentFigure.id,
      finishedAt: new Date(),
      updatedAt: new Date(),
      payload: updatedPayload,
    })
    .where(eq(researchJobs.id, jobId))

  return Response.json({
    ok: true,
    jobId,
    figureId: currentFigure.id,
    mode,
    fieldsChanged,
    sourcesUsed: fetched.length,
    citationsInserted: insertedCitationCount,
  })
}

// ── battle_ingest ──────────────────────────────────────────────────────
//
// Crawl + LLM extract + INSERT a new draft `battles` row, then INSERT
// per-citation rows scoped to that battle. Mirrors `handleFigureIngest`
// but uses the battle schema + resolves `locationSlug` / `commanderName`
// against the existing tables.
//
// On `locationSlug` miss: leave `locationId` null and append the AI's
// suggested name to `eventDateNotes` so the reviewer can map it.
// On `commanderName` miss: leave `commanderId` null. No fallback.

function battleSlugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[ؐ-ًؚ-ٰٟۖ-ۭ]/g, '')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 140) || `battle-${Date.now()}`
  )
}

async function resolveLocationIdBySlug(slug: string): Promise<string | null> {
  const row = await db.query.locations.findFirst({
    where: and(eq(locations.slug, slug), isNull(locations.deletedAt)),
    columns: { id: true },
  })
  return row?.id ?? null
}

async function resolveCommanderIdByName(name: string): Promise<string | null> {
  const like = `%${name.trim()}%`
  const row = await db.query.figures.findFirst({
    where: and(
      or(ilike(figures.nameFullAr, like), ilike(figures.nameFullId, like))!,
      isNull(figures.deletedAt),
    ),
    columns: { id: true },
  })
  return row?.id ?? null
}

async function handleBattleIngest(jobId: string): Promise<Response> {
  const log = logger.child({ route: '/api/jobs/research', jobType: 'battle_ingest', jobId })

  // 1. Load the job row.
  const job = await db.query.researchJobs.findFirst({
    where: eq(researchJobs.id, jobId),
  })
  if (!job) {
    log.warn({ jobId }, 'battle_ingest: job row not found')
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `research_jobs not found: ${jobId}` } },
      { status: 404 },
    )
  }

  // 2. Idempotency.
  if (job.status === 'completed') {
    return Response.json({ ok: true, battleId: job.resultFigureId, alreadyCompleted: true })
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

  // 4. Coerce payload. The producer writes { name, type?, hints? }.
  const payload = job.payload as {
    name?: string
    type?: 'ghazwah' | 'sariyyah' | 'futuhat'
    hints?: string
  } | null
  if (!payload?.name) {
    const msg = 'payload missing name'
    await markFailed(jobId, 'internal_error', msg)
    log.error({ jobId, payload }, msg)
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: msg } },
      { status: 422 },
    )
  }

  // 5. Build admin hints — forwarded into the user-prompt body, NOT as a
  //    fake source with `url: 'admin://hints'`. The non-http scheme would
  //    otherwise leak into citations and confuse the model.
  const hintParts: string[] = []
  if (payload.hints) hintParts.push(payload.hints)
  if (payload.type) {
    hintParts.push(`Jenis pertempuran yang diharapkan: ${payload.type}.`)
  }
  const combinedHints = hintParts.length > 0 ? hintParts.join('\n') : undefined

  // 6. Whitelist sources first (same vetted domains used for figures), then
  //    fall back to DDG tier-A (within whitelist) and tier-B (broader salafi)
  //    when the whitelist URLs don't yield a usable extraction. Without the
  //    fallback ladder, narratives come back nearly empty whenever the
  //    direct whitelist URL probe misses.
  const domains = await loadActiveWhitelist()
  const whitelistUrls = (await searchWhitelist(payload.name, domains)).slice(
    0,
    MAX_SOURCES * 2,
  )

  const whitelistFetch = await fetchSources(whitelistUrls, log, 'whitelist')
  if (whitelistFetch.rateLimited) {
    await markFailed(jobId, 'rate_limited', whitelistFetch.rateLimited.message)
    return Response.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: whitelistFetch.rateLimited.message } },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.ceil(whitelistFetch.rateLimited.retryAfterMs / 1000)),
        },
      },
    )
  }

  let fetched: FetchedSource[] = whitelistFetch.fetched
  let extraction: BattleSuccess | null = null
  if (fetched.length > 0) {
    const initial = await tryExtractBattle(payload.name, fetched, combinedHints, log)
    if (initial && 'failure' in initial) {
      const failure = initial.failure
      const httpStatus = failure.code === 'provider_not_configured' ? 503 : 500
      await markFailed(jobId, failure.code, failure.message)
      return Response.json(
        { ok: false, error: { code: failure.code.toUpperCase(), message: failure.message } },
        { status: httpStatus },
      )
    }
    if (initial) extraction = initial
  }

  // 7. Fallback ladder — DDG within whitelist (tier A), then broader salafi
  //    search (tier B). Same substantive check as figures: fall back when
  //    the AI echoed the battle name but wrote null for every narrative /
  //    metadata field (the "search-result-page-as-source" failure mode).
  const needsFallback =
    !extraction || !battleExtractionLooksSubstantive(extraction.result.battleData)
  if (needsFallback) {
    const topDomains = [...domains]
      .sort((a, b) => b.priority - a.priority)
      .map((d) => d.domain)

    log.warn(
      { jobId, name: payload.name },
      'battle whitelist path yielded no usable extraction — tier A: DDG within whitelist',
    )
    const tierAUrls = await webSearchWithinWhitelist(payload.name, topDomains, {
      limit: MAX_SOURCES * 2,
    })
    const tierA = await tryFallbackTierBattle(
      payload.name,
      tierAUrls,
      combinedHints,
      log,
      'ddg-within-whitelist',
    )
    const applyTier = async (
      tier: BattleFallbackTierResult,
    ): Promise<Response | { applied: boolean }> => {
      if (tier.kind === 'rate_limited') {
        await markFailed(jobId, 'rate_limited', tier.err.message)
        return Response.json(
          { ok: false, error: { code: 'RATE_LIMITED', message: tier.err.message } },
          {
            status: 429,
            headers: {
              'retry-after': String(Math.ceil(tier.err.retryAfterMs / 1000)),
            },
          },
        )
      }
      if (tier.kind === 'failure') {
        const failure = tier.failure
        const httpStatus = failure.code === 'provider_not_configured' ? 503 : 500
        await markFailed(jobId, failure.code, failure.message)
        return Response.json(
          { ok: false, error: { code: failure.code.toUpperCase(), message: failure.message } },
          { status: httpStatus },
        )
      }
      if (tier.kind === 'accepted') {
        fetched = tier.fetched
        extraction = tier.attempt
        return { applied: true }
      }
      return { applied: false }
    }

    const aOutcome = await applyTier(tierA)
    if (aOutcome instanceof Response) return aOutcome
    if (!aOutcome.applied) {
      log.warn(
        { jobId, name: payload.name },
        'tier A yielded nothing — tier B: broader DDG salaf search',
      )
      const tierBUrls = await webSearchSalafi(payload.name, { limit: MAX_SOURCES * 2 })
      const tierB = await tryFallbackTierBattle(
        payload.name,
        tierBUrls,
        combinedHints,
        log,
        'ddg-salaf',
      )
      const bOutcome = await applyTier(tierB)
      if (bOutcome instanceof Response) return bOutcome
    }
  }

  if (!extraction) {
    const msg =
      'Tidak ada sumber yang dapat dikutip untuk sirah perang ini. Tambahkan domain whitelist atau ubah ejaan nama.'
    await markFailed(jobId, 'no_sources', msg)
    return Response.json(
      { ok: false, error: { code: 'NO_SOURCES', message: msg } },
      { status: 422 },
    )
  }

  const { battleData, citations: cites, modelUsed } = extraction.result

  // 8. Validate the LLM actually identified the battle.
  if (!battleData.nameAr && !battleData.nameId) {
    const msg = 'Sumber yang diambil tidak cocok dengan perang — coba sempurnakan ejaan.'
    await markFailed(jobId, 'extraction_empty', msg)
    return Response.json(
      { ok: false, error: { code: 'EXTRACTION_EMPTY', message: msg } },
      { status: 422 },
    )
  }

  // 8b. Anti-hallucination guard — narrative/strategy text without citations
  //     means the LLM invented content. Bail before we persist a draft.
  const hasBattleBody = Boolean(
    battleData.narrativeAr ||
      battleData.narrativeId ||
      battleData.strategyAr ||
      battleData.strategyId,
  )
  if (hasBattleBody && cites.length === 0) {
    const msg =
      'AI menulis narasi perang tanpa kutipan sumber — kemungkinan halusinasi. Coba ulangi.'
    log.warn(
      { jobId, name: payload.name },
      'battle extractor produced body without citations — aborting',
    )
    await markFailed(jobId, 'extraction_empty', msg)
    return Response.json(
      { ok: false, error: { code: 'EXTRACTION_EMPTY', message: msg } },
      { status: 422 },
    )
  }

  // 10. Resolve location + commander against existing tables.
  let locationId: string | null = null
  let locationFallbackNote: string | null = null
  if (battleData.locationSlug) {
    locationId = await resolveLocationIdBySlug(battleData.locationSlug)
    if (!locationId) {
      // Surface the AI's guess so the reviewer can wire it up later.
      locationFallbackNote = `[AI suggested location: ${battleData.locationSlug}]`
    }
  }

  let commanderId: string | null = null
  if (battleData.commanderName) {
    commanderId = await resolveCommanderIdByName(battleData.commanderName)
  }

  // 11. Build the `event_date_notes` blob — prefer the LLM's note, fall back
  //     to the location fallback note.
  const combinedNotes =
    [battleData.eventDateNotes, locationFallbackNote].filter(Boolean).join(' ').trim() ||
    null

  // 12. Insert draft row + citations (Neon HTTP — single round-trip best
  //     effort; atomicity is not strict since Neon-http lacks transactions).
  const slugBase = battleSlugify(battleData.nameId || payload.name)
  const slug = `${slugBase}-${Date.now().toString(36)}`

  const [row] = await db
    .insert(battles)
    .values({
      slug,
      nameAr: battleData.nameAr ?? payload.name,
      nameId: battleData.nameId ?? payload.name,
      type: battleData.type ?? payload.type ?? 'ghazwah',
      eventDateAh: battleData.eventDateAh ?? null,
      eventDateCe: battleData.eventDateCe ?? null,
      eventDatePrecision: battleData.eventDatePrecision ?? null,
      eventDateNotes: combinedNotes,
      locationId,
      commanderId,
      opponentForce: battleData.opponentForce ?? null,
      muslimCount: battleData.muslimCount ?? null,
      opponentCount: battleData.opponentCount ?? null,
      outcome: battleData.outcome ?? null,
      casualtiesMuslim: battleData.casualtiesMuslim ?? null,
      casualtiesOpponent: battleData.casualtiesOpponent ?? null,
      strategyId: battleData.strategyId ?? null,
      strategyAr: battleData.strategyAr ?? null,
      narrativeId: battleData.narrativeId ?? null,
      narrativeAr: battleData.narrativeAr ?? null,
      significanceId: battleData.significanceId ?? null,
      significanceAr: battleData.significanceAr ?? null,
      status: 'draft',
      createdBy: job.createdBy ?? null,
    })
    .returning({ id: battles.id })

  if (!row) {
    const msg = 'failed to insert battle draft'
    await markFailed(jobId, 'internal_error', msg)
    return Response.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: msg } },
      { status: 500 },
    )
  }

  // 13. Insert citations.
  const citationInserts = cites.map((c) => ({
    contentType: 'battle',
    contentId: row.id,
    fieldPath: null,
    sourceUrl: c.sourceUrl,
    sourceDomain: hostOf(c.sourceUrl),
    sourceExcerptAr: null,
    sourceExcerptId: c.sourceExcerptId,
    sourceLang: 'id' as const,
    modelUsed,
    extractedAt: new Date(),
  }))
  let insertedCitationCount = 0
  if (citationInserts.length > 0) {
    // Idempotent against `citations_unique_active_idx`.
    const inserted = await db
      .insert(citations)
      .values(citationInserts)
      .onConflictDoNothing()
      .returning({ id: citations.id })
    insertedCitationCount = inserted.length
  }

  // 14. Mark the job complete. `resultFigureId` is the generic
  //     "result content id" — see column comment in the figure flow.
  await db
    .update(researchJobs)
    .set({
      status: 'completed',
      resultFigureId: row.id,
      finishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(researchJobs.id, jobId))

  return Response.json({
    ok: true,
    jobId,
    battleId: row.id,
    sourcesUsed: fetched.length,
    citationsInserted: insertedCitationCount,
    locationResolved: locationId !== null,
    commanderResolved: commanderId !== null,
  })
}

// ── battle_reingest ────────────────────────────────────────────────────
//
// Refresh an EXISTING battle row. Same merge semantics as figure_reingest:
//   - 'enrich': only fill fields currently null/empty.
//   - 'replace': overwrite the columns named in `focusFields`.

const BATTLE_MERGEABLE_FIELDS = [
  'nameAr',
  'nameId',
  'eventDateAh',
  'eventDateCe',
  'eventDatePrecision',
  'eventDateNotes',
  'opponentForce',
  'muslimCount',
  'opponentCount',
  'outcome',
  'casualtiesMuslim',
  'casualtiesOpponent',
  'strategyId',
  'strategyAr',
  'narrativeId',
  'narrativeAr',
  'significanceId',
  'significanceAr',
] as const

type BattleMergeableField = (typeof BATTLE_MERGEABLE_FIELDS)[number]

// "Virtual" focus fields the admin can toggle — these do NOT correspond to
// columns on `battles`; they switch on the participant / phase sub-pipelines
// in `handleBattleReIngest`. The route's Zod allowlist treats them as opaque
// strings so the worker can branch on them without typing them as column
// names.
type BattleVirtualFocus = 'participants' | 'phases'
type BattleFocusField = BattleMergeableField | BattleVirtualFocus | 'citations'

/**
 * Map the AI-emitted role onto the DB enum. The AI is allowed to emit nine
 * fine-grained values (see `battle-schema.ts`); the DB enum has every value
 * verbatim EXCEPT `soldier` and `martyr`, which collapse onto the legacy
 * `sahabat` and `fallen` buckets respectively. Keeps existing seeders /
 * curated rows valid without a destructive enum rename.
 */
function mapParticipantRole(
  aiRole:
    | 'commander'
    | 'sub_commander'
    | 'soldier'
    | 'martyr'
    | 'captured'
    | 'wounded'
    | 'witness'
    | 'flag_bearer'
    | 'envoy',
):
  | 'commander'
  | 'sub_commander'
  | 'sahabat'
  | 'fallen'
  | 'captured'
  | 'wounded'
  | 'witness'
  | 'flag_bearer'
  | 'envoy' {
  if (aiRole === 'soldier') return 'sahabat'
  if (aiRole === 'martyr') return 'fallen'
  return aiRole
}

/**
 * Resolve a free-text figure name (either Indonesian or Arabic) against the
 * `figures` table via case-insensitive ILIKE. Tries the longer string first
 * to bias toward specific matches over kunyah-only collisions. Returns null
 * when no active figure matches — the caller is expected to SKIP the row
 * rather than insert a ghost.
 */
async function resolveFigureIdByName(args: {
  nameId: string
  nameAr: string
}): Promise<string | null> {
  const id = args.nameId.trim()
  const ar = args.nameAr.trim()
  if (!id && !ar) return null

  // Exact-ish ILIKE on the longer name first (more specific), then the other.
  const clauses = [
    id ? ilike(figures.nameFullId, `%${id}%`) : null,
    ar ? ilike(figures.nameFullAr, `%${ar}%`) : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)
  if (clauses.length === 0) return null

  const row = await db.query.figures.findFirst({
    where: and(or(...clauses)!, isNull(figures.deletedAt)),
    columns: { id: true },
  })
  return row?.id ?? null
}

async function handleBattleReIngest(jobId: string): Promise<Response> {
  const log = logger.child({
    route: '/api/jobs/research',
    jobType: 'battle_reingest',
    jobId,
  })

  // 1. Load the job row.
  const job = await db.query.researchJobs.findFirst({
    where: eq(researchJobs.id, jobId),
  })
  if (!job) {
    log.warn({ jobId }, 'battle_reingest: job row not found')
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND', message: `research_jobs not found: ${jobId}` } },
      { status: 404 },
    )
  }

  if (job.status === 'completed') {
    return Response.json({ ok: true, battleId: job.resultFigureId, alreadyCompleted: true })
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

  // 2. Mark running.
  await db
    .update(researchJobs)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(researchJobs.id, jobId))

  // 3. Coerce payload.
  const payload = job.payload as {
    battleId?: string
    slug?: string
    name?: string
    type?: 'ghazwah' | 'sariyyah' | 'futuhat'
    mode?: 'enrich' | 'replace'
    /** Mix of real battle columns and virtual sub-pipelines (`participants`,
     *  `phases`, `citations`). The merge loop filters out virtual entries. */
    focusFields?: BattleFocusField[]
    hints?: string
    originalSnapshot?: Record<string, unknown>
  } | null

  if (!payload?.battleId || !payload?.name) {
    const msg = 'payload missing battleId/name'
    await markFailed(jobId, 'internal_error', msg)
    log.error({ jobId, payload }, msg)
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: msg } },
      { status: 422 },
    )
  }

  // 4. Load the current battle.
  const currentBattle = await db.query.battles.findFirst({
    where: and(eq(battles.id, payload.battleId), isNull(battles.deletedAt)),
  })
  if (!currentBattle) {
    const msg = `Battle not found or deleted: ${payload.battleId}`
    await markFailed(jobId, 'not_found', msg)
    log.warn({ jobId, battleId: payload.battleId }, 'battle_reingest: battle missing')
    return Response.json(
      { ok: false, error: { code: 'NOT_FOUND', message: msg } },
      { status: 404 },
    )
  }

  // 5. Hints + ladder. Don't reuse the ingest helper — it INSERTs a new row;
  //    we only UPDATE here. Otherwise the source pipeline (whitelist → DDG
  //    tier-A → tier-B) is identical.
  const focusList = payload.focusFields ?? []
  const hintParts: string[] = []
  if (payload.hints) hintParts.push(payload.hints)
  if (focusList.length > 0) {
    hintParts.push(`Fokuskan ekstraksi pada kolom berikut: ${focusList.join(', ')}.`)
  }
  // Hints land in the user-prompt body (extract-battle.ts:buildUserPrompt),
  // never as a fake `admin://hints` source — the non-http URL would leak
  // into citations otherwise.
  const combinedHints = hintParts.length > 0 ? hintParts.join('\n') : undefined

  const domains = await loadActiveWhitelist()
  const whitelistUrls = (await searchWhitelist(payload.name, domains)).slice(
    0,
    MAX_SOURCES * 2,
  )

  const whitelistFetch = await fetchSources(whitelistUrls, log, 'whitelist')
  if (whitelistFetch.rateLimited) {
    await markFailed(jobId, 'rate_limited', whitelistFetch.rateLimited.message)
    return Response.json(
      { ok: false, error: { code: 'RATE_LIMITED', message: whitelistFetch.rateLimited.message } },
      {
        status: 429,
        headers: {
          'retry-after': String(Math.ceil(whitelistFetch.rateLimited.retryAfterMs / 1000)),
        },
      },
    )
  }

  let fetched: FetchedSource[] = whitelistFetch.fetched
  let extractionAttempt: BattleSuccess | null = null
  if (fetched.length > 0) {
    const initial = await tryExtractBattle(payload.name, fetched, combinedHints, log)
    if (initial && 'failure' in initial) {
      const failure = initial.failure
      const httpStatus = failure.code === 'provider_not_configured' ? 503 : 500
      await markFailed(jobId, failure.code, failure.message)
      return Response.json(
        { ok: false, error: { code: failure.code.toUpperCase(), message: failure.message } },
        { status: httpStatus },
      )
    }
    if (initial) extractionAttempt = initial
  }

  // 6. Fallback ladder — DDG within whitelist (tier A), then broader salafi
  //    search (tier B). Mirrors `handleBattleIngest` including the
  //    substantive-extraction check so a name-only echo triggers fallback.
  const needsFallback =
    !extractionAttempt ||
    !battleExtractionLooksSubstantive(extractionAttempt.result.battleData)
  if (needsFallback) {
    const topDomains = [...domains]
      .sort((a, b) => b.priority - a.priority)
      .map((d) => d.domain)

    log.warn(
      { jobId, name: payload.name },
      'battle reingest whitelist path yielded no usable extraction — tier A: DDG within whitelist',
    )
    const tierAUrls = await webSearchWithinWhitelist(payload.name, topDomains, {
      limit: MAX_SOURCES * 2,
    })
    const tierA = await tryFallbackTierBattle(
      payload.name,
      tierAUrls,
      combinedHints,
      log,
      'ddg-within-whitelist',
    )
    const applyTier = async (
      tier: BattleFallbackTierResult,
    ): Promise<Response | { applied: boolean }> => {
      if (tier.kind === 'rate_limited') {
        await markFailed(jobId, 'rate_limited', tier.err.message)
        return Response.json(
          { ok: false, error: { code: 'RATE_LIMITED', message: tier.err.message } },
          {
            status: 429,
            headers: {
              'retry-after': String(Math.ceil(tier.err.retryAfterMs / 1000)),
            },
          },
        )
      }
      if (tier.kind === 'failure') {
        const failure = tier.failure
        const httpStatus = failure.code === 'provider_not_configured' ? 503 : 500
        await markFailed(jobId, failure.code, failure.message)
        return Response.json(
          { ok: false, error: { code: failure.code.toUpperCase(), message: failure.message } },
          { status: httpStatus },
        )
      }
      if (tier.kind === 'accepted') {
        fetched = tier.fetched
        extractionAttempt = tier.attempt
        return { applied: true }
      }
      return { applied: false }
    }

    const aOutcome = await applyTier(tierA)
    if (aOutcome instanceof Response) return aOutcome
    if (!aOutcome.applied) {
      log.warn(
        { jobId, name: payload.name },
        'tier A yielded nothing — tier B: broader DDG salaf search',
      )
      const tierBUrls = await webSearchSalafi(payload.name, { limit: MAX_SOURCES * 2 })
      const tierB = await tryFallbackTierBattle(
        payload.name,
        tierBUrls,
        combinedHints,
        log,
        'ddg-salaf',
      )
      const bOutcome = await applyTier(tierB)
      if (bOutcome instanceof Response) return bOutcome
    }
  }

  if (!extractionAttempt) {
    const msg =
      'Tidak ada sumber yang dapat dikutip untuk sirah perang ini. Tambahkan domain whitelist atau ubah ejaan nama.'
    await markFailed(jobId, 'no_sources', msg)
    return Response.json(
      { ok: false, error: { code: 'NO_SOURCES', message: msg } },
      { status: 422 },
    )
  }

  const { battleData, citations: cites, modelUsed } = extractionAttempt.result

  // Anti-hallucination guard — same gate as `handleBattleIngest`. Refuse
  // to merge narrative/strategy body text that arrives without citations.
  const hasBattleBody = Boolean(
    battleData.narrativeAr ||
      battleData.narrativeId ||
      battleData.strategyAr ||
      battleData.strategyId,
  )
  if (hasBattleBody && cites.length === 0) {
    const msg =
      'AI menulis narasi perang tanpa kutipan sumber — kemungkinan halusinasi. Coba ulangi.'
    log.warn(
      { jobId, battleId: payload.battleId },
      'battle reingest produced body without citations — aborting',
    )
    await markFailed(jobId, 'extraction_empty', msg)
    return Response.json(
      { ok: false, error: { code: 'EXTRACTION_EMPTY', message: msg } },
      { status: 422 },
    )
  }

  // 6. Per-mode merge patch.
  const mode: 'enrich' | 'replace' = payload.mode ?? 'enrich'
  // `participants` / `phases` / `citations` are virtual focus fields routed
  // to their own sub-pipelines below — exclude them from the column-merge
  // set so the loop only ever touches real `battles` columns.
  const replaceFields: Set<BattleMergeableField> = new Set(
    mode === 'replace'
      ? (payload.focusFields ?? []).filter(
          (f): f is BattleMergeableField =>
            (BATTLE_MERGEABLE_FIELDS as readonly string[]).includes(f),
        )
      : [],
  )
  const focusEnabled = new Set<BattleFocusField>(payload.focusFields ?? [])
  const wantsParticipants = focusEnabled.has('participants')
  const wantsPhases = focusEnabled.has('phases')

  const fieldsChanged: BattleMergeableField[] = []
  const patch: Partial<Record<BattleMergeableField, unknown>> = {}

  for (const field of BATTLE_MERGEABLE_FIELDS) {
    const aiValue = battleData[field as keyof typeof battleData] as unknown
    if (isEmptyValue(aiValue)) continue
    const currentValue = (currentBattle as unknown as Record<string, unknown>)[field]
    if (mode === 'enrich') {
      if (!isEmptyValue(currentValue)) continue
    } else {
      if (!replaceFields.has(field)) continue
    }
    patch[field] = aiValue
    fieldsChanged.push(field)
  }

  // 7. Attempt to resolve location/commander if the current row is missing
  //    them — both are conservative (only fill, never overwrite).
  let locationFilled = false
  if (!currentBattle.locationId && battleData.locationSlug) {
    const locId = await resolveLocationIdBySlug(battleData.locationSlug)
    if (locId) {
      ;(patch as Record<string, unknown>)['locationId'] = locId
      locationFilled = true
    }
  }
  let commanderFilled = false
  if (!currentBattle.commanderId && battleData.commanderName) {
    const commanderId = await resolveCommanderIdByName(battleData.commanderName)
    if (commanderId) {
      ;(patch as Record<string, unknown>)['commanderId'] = commanderId
      commanderFilled = true
    }
  }

  // 8. UPDATE the battle row only if we have something to change.
  if (Object.keys(patch).length > 0) {
    await db
      .update(battles)
      .set({
        ...(patch as Partial<typeof battles.$inferInsert>),
        updatedAt: new Date(),
        ...(job.createdBy ? { updatedBy: job.createdBy } : {}),
      })
      .where(eq(battles.id, currentBattle.id))
  }

  // 8b. Participants (`battle_participants`) sub-pipeline ──────────────
  //
  // Mode semantics:
  //   - 'enrich': INSERT a new row only when `(battleId, figureId)` is not
  //     already in the table. Existing curated rows are NEVER updated.
  //   - 'replace': UPDATE the existing row's role/side/notes from the AI
  //     output, OR INSERT if missing. Pre-existing rows whose figure does
  //     NOT appear in the AI output are LEFT ALONE — we never wipe curated
  //     tokoh, even in replace mode.
  //
  // Resolution: each AI participant carries `figureNameId` / `figureNameAr`;
  // the worker ILIKE-matches against `figures.nameFullId/Ar`. Unresolved
  // names are SKIPPED (logged) — the full ingest flow is expected to create
  // the figure first, then a follow-up re-ingest picks them up.
  //
  // Tracked for the diff dialog under `metadata.participants`:
  //   - added:    figures inserted this run
  //   - updated:  rows whose role/side/notes were rewritten (replace only)
  //   - skipped:  AI names that could not be resolved
  const aiParticipants = (battleData as { participants?: unknown }).participants
  const participantStats: {
    added: { figureId: string; nameId: string; nameAr: string; role: string }[]
    updated: { figureId: string; nameId: string }[]
    skipped: { nameId: string; nameAr: string }[]
  } = { added: [], updated: [], skipped: [] }

  if (wantsParticipants && Array.isArray(aiParticipants) && aiParticipants.length > 0) {
    // Existing participant rows for this battle — used to short-circuit
    // INSERTs in enrich mode and to pick UPDATE vs INSERT in replace mode.
    const existing = await db
      .select({
        figureId: battleParticipants.figureId,
      })
      .from(battleParticipants)
      .where(eq(battleParticipants.battleId, currentBattle.id))
    const existingSet = new Set(existing.map((r) => r.figureId))

    for (const raw of aiParticipants) {
      const p = raw as {
        figureNameId: string
        figureNameAr: string
        role:
          | 'commander'
          | 'sub_commander'
          | 'soldier'
          | 'martyr'
          | 'captured'
          | 'wounded'
          | 'witness'
          | 'flag_bearer'
          | 'envoy'
        side: 'muslim' | 'opponent' | 'both'
        notesId: string | null
        notesAr: string | null
      }
      const resolvedId = await resolveFigureIdByName({
        nameId: p.figureNameId,
        nameAr: p.figureNameAr,
      })
      if (!resolvedId) {
        log.warn(
          { battleId: currentBattle.id, nameId: p.figureNameId, nameAr: p.figureNameAr },
          'participant unresolved — skipped (will be picked up after figure_ingest)',
        )
        participantStats.skipped.push({ nameId: p.figureNameId, nameAr: p.figureNameAr })
        continue
      }

      const dbRole = mapParticipantRole(p.role)
      const alreadyExists = existingSet.has(resolvedId)

      if (mode === 'enrich') {
        if (alreadyExists) continue
        try {
          await db.insert(battleParticipants).values({
            battleId: currentBattle.id,
            figureId: resolvedId,
            role: dbRole,
            side: p.side,
            notesAr: p.notesAr,
            notesId: p.notesId,
          })
          participantStats.added.push({
            figureId: resolvedId,
            nameId: p.figureNameId,
            nameAr: p.figureNameAr,
            role: dbRole,
          })
          existingSet.add(resolvedId)
        } catch (err) {
          log.warn(
            { err: (err as Error).message, battleId: currentBattle.id, figureId: resolvedId },
            'enrich INSERT participant failed (non-fatal)',
          )
        }
      } else {
        // replace mode: UPDATE if present, else INSERT.
        if (alreadyExists) {
          await db
            .update(battleParticipants)
            .set({
              role: dbRole,
              side: p.side,
              notesAr: p.notesAr,
              notesId: p.notesId,
            })
            .where(
              and(
                eq(battleParticipants.battleId, currentBattle.id),
                eq(battleParticipants.figureId, resolvedId),
              ),
            )
          participantStats.updated.push({ figureId: resolvedId, nameId: p.figureNameId })
        } else {
          try {
            await db.insert(battleParticipants).values({
              battleId: currentBattle.id,
              figureId: resolvedId,
              role: dbRole,
              side: p.side,
              notesAr: p.notesAr,
              notesId: p.notesId,
            })
            participantStats.added.push({
              figureId: resolvedId,
              nameId: p.figureNameId,
              nameAr: p.figureNameAr,
              role: dbRole,
            })
            existingSet.add(resolvedId)
          } catch (err) {
            log.warn(
              { err: (err as Error).message, battleId: currentBattle.id, figureId: resolvedId },
              'replace INSERT participant failed (non-fatal)',
            )
          }
        }
      }
    }
  }

  // 8c. Phases (`battle_phases`) sub-pipeline ──────────────────────────
  //
  // Mode semantics:
  //   - 'enrich': only INSERT new phases when the battle currently has ZERO
  //     non-soft-deleted phase rows. We never mix AI phases with curated
  //     ones (that would break the orderIndex contract).
  //   - 'replace': soft-delete every existing phase for this battle, then
  //     INSERT the new ordered set. The originalSnapshot in research_jobs
  //     payload already captured the pre-state if a future "Tolak" needs
  //     to restore.
  //
  // Slug resolution: `locationSlug`, `arrowFromSlug`, `arrowToSlug` map to
  // `locations.slug` via exact lookup; failures fall back to null so the
  // phase still inserts (the reviewer can wire it up later).
  const aiPhases = (battleData as { phases?: unknown }).phases
  const phasesStats: {
    inserted: number
    softDeleted: number
    titlesId: string[]
  } = { inserted: 0, softDeleted: 0, titlesId: [] }

  if (wantsPhases && Array.isArray(aiPhases) && aiPhases.length > 0) {
    const existingPhases = await db
      .select({ id: battlePhases.id })
      .from(battlePhases)
      .where(and(eq(battlePhases.battleId, currentBattle.id), isNull(battlePhases.deletedAt)))

    const canWritePhases =
      mode === 'replace' ? true : existingPhases.length === 0

    if (canWritePhases) {
      // Resolve every unique slug in one pass — avoids N+1 round-trips when
      // the AI emits a long chain of phases sharing locations.
      const allSlugs = new Set<string>()
      for (const raw of aiPhases) {
        const p = raw as {
          locationSlug: string | null
          arrowFromSlug: string | null
          arrowToSlug: string | null
        }
        if (p.locationSlug) allSlugs.add(p.locationSlug)
        if (p.arrowFromSlug) allSlugs.add(p.arrowFromSlug)
        if (p.arrowToSlug) allSlugs.add(p.arrowToSlug)
      }
      const slugMap = new Map<string, string>()
      if (allSlugs.size > 0) {
        const rows = await db
          .select({ id: locations.id, slug: locations.slug })
          .from(locations)
          .where(isNull(locations.deletedAt))
        for (const r of rows) {
          if (allSlugs.has(r.slug)) slugMap.set(r.slug, r.id)
        }
      }
      const lookupSlug = (slug: string | null | undefined): string | null =>
        slug ? slugMap.get(slug) ?? null : null

      // Build the insert payload first so we can validate orderIndex
      // uniqueness without hitting the DB.
      const phaseRows = (aiPhases as Array<{
        orderIndex: number
        nameId: string
        nameAr: string
        narrativeId: string
        narrativeAr: string | null
        locationSlug: string | null
        arrowFromSlug: string | null
        arrowToSlug: string | null
        durationHours: number | null
      }>)
        // Stable sort by orderIndex so the DB rows reflect AI sequence.
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((p) => ({
          battleId: currentBattle.id,
          phaseOrder: p.orderIndex,
          titleId: p.nameId,
          titleAr: p.nameAr,
          descriptionId: p.narrativeId,
          descriptionAr: p.narrativeAr,
          phaseLocationId: lookupSlug(p.locationSlug),
          arrowFromId: lookupSlug(p.arrowFromSlug),
          arrowToId: lookupSlug(p.arrowToSlug),
          durationHours: p.durationHours,
          createdBy: job.createdBy ?? null,
        }))

      if (mode === 'replace' && existingPhases.length > 0) {
        // Soft-delete the curated rows in one round-trip. We deliberately
        // do NOT hard-delete so a future Tolak can resurrect them.
        const now = new Date()
        await db
          .update(battlePhases)
          .set({ deletedAt: now, deletedBy: job.createdBy ?? null })
          .where(
            and(
              eq(battlePhases.battleId, currentBattle.id),
              isNull(battlePhases.deletedAt),
            ),
          )
        phasesStats.softDeleted = existingPhases.length
      }

      if (phaseRows.length > 0) {
        const inserted = await db
          .insert(battlePhases)
          .values(phaseRows)
          .returning({ id: battlePhases.id, titleId: battlePhases.titleId })
        phasesStats.inserted = inserted.length
        phasesStats.titlesId = inserted.map((r) => r.titleId ?? '').filter(Boolean)
      }
    } else {
      log.info(
        { battleId: currentBattle.id, existingCount: existingPhases.length },
        'enrich mode: existing phases present — skipped phase insert',
      )
    }
  }

  // 9. INSERT new citations. We never DELETE old citations.
  const citationInserts = cites.map((c) => ({
    contentType: 'battle',
    contentId: currentBattle.id,
    fieldPath: null,
    sourceUrl: c.sourceUrl,
    sourceDomain: hostOf(c.sourceUrl),
    sourceExcerptAr: null,
    sourceExcerptId: c.sourceExcerptId,
    sourceLang: 'id' as const,
    modelUsed,
    extractedAt: new Date(),
  }))
  let insertedCitationCount = 0
  if (citationInserts.length > 0) {
    // Idempotent against `citations_unique_active_idx`.
    const inserted = await db
      .insert(citations)
      .values(citationInserts)
      .onConflictDoNothing()
      .returning({ id: citations.id })
    insertedCitationCount = inserted.length
  }

  // 10. Mark the job complete.
  const updatedPayload = {
    ...(payload as Record<string, unknown>),
    metadata: {
      mode,
      sourcesUsed: fetched.length,
      fieldsChanged,
      locationFilled,
      commanderFilled,
      citationsInserted: insertedCitationCount,
      participantsAdded: participantStats.added.length,
      participantsUpdated: participantStats.updated.length,
      participantsSkipped: participantStats.skipped.length,
      participants: participantStats,
      phasesInserted: phasesStats.inserted,
      phasesSoftDeleted: phasesStats.softDeleted,
      phases: phasesStats,
      modelUsed,
    },
  }
  await db
    .update(researchJobs)
    .set({
      status: 'completed',
      resultFigureId: currentBattle.id,
      finishedAt: new Date(),
      updatedAt: new Date(),
      payload: updatedPayload,
    })
    .where(eq(researchJobs.id, jobId))

  return Response.json({
    ok: true,
    jobId,
    battleId: currentBattle.id,
    mode,
    fieldsChanged,
    sourcesUsed: fetched.length,
    citationsInserted: insertedCitationCount,
    locationFilled,
    commanderFilled,
    participantsAdded: participantStats.added.length,
    participantsUpdated: participantStats.updated.length,
    participantsSkipped: participantStats.skipped.length,
    phasesInserted: phasesStats.inserted,
    phasesSoftDeleted: phasesStats.softDeleted,
  })
}

// ── insertNasabChain ───────────────────────────────────────────────────
//
// Walk a parent-up chain (`child → parent → grandparent → …`) and INSERT
// the corresponding `figure_relations` rows. Missing ancestors are upserted
// as minimal `shalih_pre_rasul` `figures` rows so the FK constraint holds.
//
// Convention (matches seeders/027_relations.ts):
//   - For each (child, parent) pair, INSERT
//     `(figureId=parent, relatedId=child, relationType='father')`.
//
// Idempotent — the unique partial index on `(figureId, relatedId,
// relationType) WHERE deleted_at IS NULL` lets us rely on
// `onConflictDoNothing`.

interface NasabChainLink {
  nameId: string
  nameAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
}

async function insertNasabChain(args: {
  seedFigureId: string
  seedFigureName: string
  chain: NasabChainLink[]
  createdBy: string | null
  log: typeof logger
}): Promise<void> {
  const { seedFigureId, chain, createdBy, log } = args

  // Resolve the `shalih_pre_rasul` category id once — every synthesised
  // ancestor figure goes into that bucket. If it's missing, we silently
  // abort (the AI ingest pipeline is best-effort).
  const cat = await db.query.figureCategories.findFirst({
    where: and(
      eq(figureCategories.slug, 'shalih_pre_rasul'),
      isNull(figureCategories.deletedAt),
    ),
    columns: { id: true },
  })
  if (!cat) {
    log.warn('nasab: shalih_pre_rasul category missing — skipping chain insert')
    return
  }
  const ancestorCategoryId = cat.id

  // Lookup helper: try to match an ancestor name against existing figures
  // (case-insensitive ILIKE on both `nameFullId` and `nameFullAr`). When we
  // find one, reuse the existing row instead of duplicating.
  async function resolveOrInsertAncestor(link: NasabChainLink): Promise<string | null> {
    const id = link.nameId.trim()
    const ar = (link.nameAr ?? '').trim()
    if (!id && !ar) return null

    const matchClauses = [
      id ? ilike(figures.nameFullId, id) : null,
      ar ? ilike(figures.nameFullAr, ar) : null,
    ].filter((c): c is NonNullable<typeof c> => c !== null)
    const existing = await db.query.figures.findFirst({
      where: and(or(...matchClauses)!, isNull(figures.deletedAt)),
      columns: { id: true },
    })
    if (existing) return existing.id

    const slug = `${slugify(id || ar)}-${Date.now().toString(36)}`
    const [created] = await db
      .insert(figures)
      .values({
        slug,
        categoryId: ancestorCategoryId,
        gender: 'male', // Nasab links go through the paternal line.
        nameFullId: id || ar,
        nameFullAr: ar || id,
        kunyahId: link.kunyahId,
        kunyahAr: link.kunyahAr,
        laqabId: link.laqabId,
        summaryId: 'Leluhur dari rantai nasab.',
        status: 'draft',
        createdBy,
      })
      .returning({ id: figures.id })
    return created?.id ?? null
  }

  // Walk the chain, pairing each link with its child (previous link or the
  // seed figure for the very first link).
  let childId: string = seedFigureId
  for (const link of chain) {
    const parentId = await resolveOrInsertAncestor(link)
    if (!parentId) break // unable to materialise — stop the chain here
    if (parentId === childId) break // defensive — avoid self-loops

    await db
      .insert(figureRelations)
      .values({
        figureId: parentId,
        relatedId: childId,
        relationType: 'father',
        notesId: link.nameId,
      })
      .onConflictDoNothing()

    // Also insert the reverse direction so the existing detail panel (which
    // reads relations where `figureId = this.id`) surfaces the parent under
    // the "Orang tua" bucket.
    await db
      .insert(figureRelations)
      .values({
        figureId: childId,
        relatedId: parentId,
        relationType: 'son',
        notesId: link.nameId,
      })
      .onConflictDoNothing()

    childId = parentId
  }
}

// ─── Location + relation resolution helpers ────────────────────────────
//
// The AI emits NAMES for locations and related figures (it doesn't know our
// DB IDs). These helpers do best-effort case-insensitive lookups against
// `locations` (by nameId/nameAr/modernName) and `figures` (by nameFullId/
// nameFullAr/nameShortId/nameShortAr). On miss we just log and skip —
// admin can wire the relation manually from the edit page.

async function resolveLocationByName(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return null
  const pattern = `%${trimmed}%`
  const row = await db.query.locations.findFirst({
    where: and(
      isNull(locations.deletedAt),
      or(
        ilike(locations.nameId, pattern),
        ilike(locations.nameAr, pattern),
        ilike(locations.modernName, pattern),
      ),
    ),
    columns: { id: true },
  })
  return row?.id ?? null
}

async function resolveFigureByName(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (trimmed.length === 0) return null
  const pattern = `%${trimmed}%`
  const row = await db.query.figures.findFirst({
    where: and(
      isNull(figures.deletedAt),
      or(
        ilike(figures.nameFullId, pattern),
        ilike(figures.nameFullAr, pattern),
        ilike(figures.nameShortId, pattern),
        ilike(figures.nameShortAr, pattern),
      ),
    ),
    columns: { id: true },
  })
  return row?.id ?? null
}

interface ExtractedLocationEntry {
  nameId: string
  nameAr: string | null
  role: 'birthplace' | 'residence' | 'dakwah' | 'martyr' | 'burial'
  periodStartAh: number | null
  periodEndAh: number | null
  notesId: string | null
}

interface ExtractedRelationEntry {
  nameId: string
  nameAr: string | null
  relationType:
    | 'teacher_of'
    | 'student_of'
    | 'father'
    | 'mother'
    | 'husband'
    | 'wife'
    | 'son'
    | 'daughter'
    | 'sibling'
    | 'companion'
    | 'descendant'
    | 'ancestor'
  notesId: string | null
}

/**
 * Resolve the three single-FK location fields (primary/death/burial) on
 * `figures`. Returns a partial patch that can be spread into an update or
 * INSERT. Best-effort: unresolved names produce no patch entry + a log.
 */
async function resolveSingleLocationFields(
  primaryName: string | null | undefined,
  deathName: string | null | undefined,
  burialName: string | null | undefined,
  log: JobLogger,
): Promise<{
  primaryLocationId?: string
  deathLocationId?: string
  burialLocationId?: string
}> {
  const out: {
    primaryLocationId?: string
    deathLocationId?: string
    burialLocationId?: string
  } = {}
  if (primaryName) {
    const id = await resolveLocationByName(primaryName)
    if (id) out.primaryLocationId = id
    else log.warn({ name: primaryName }, 'primaryLocation name not found in locations table')
  }
  if (deathName) {
    const id = await resolveLocationByName(deathName)
    if (id) out.deathLocationId = id
    else log.warn({ name: deathName }, 'deathLocation name not found')
  }
  if (burialName) {
    const id = await resolveLocationByName(burialName)
    if (id) out.burialLocationId = id
    else log.warn({ name: burialName }, 'burialLocation name not found')
  }
  return out
}

/**
 * Insert `figure_locations` rows for each AI-extracted entry. Idempotent —
 * the table has a partial unique index on (figureId, locationId, role) for
 * active rows, so `onConflictDoNothing` is safe.
 */
async function insertFigureLocations(
  figureId: string,
  entries: ExtractedLocationEntry[],
  log: JobLogger,
): Promise<number> {
  if (entries.length === 0) return 0
  let inserted = 0
  for (const entry of entries) {
    const locationId = await resolveLocationByName(entry.nameId)
    if (!locationId) {
      log.warn(
        { name: entry.nameId, role: entry.role },
        'figureLocations: location name not found — skipping',
      )
      continue
    }
    try {
      const res = await db
        .insert(figureLocations)
        .values({
          figureId,
          locationId,
          role: entry.role,
          periodStartAh: entry.periodStartAh,
          periodEndAh: entry.periodEndAh,
          notesId: entry.notesId,
        })
        .onConflictDoNothing()
        .returning({ id: figureLocations.id })
      if (res[0]) inserted++
    } catch (err) {
      log.warn(
        { err: (err as Error).message, name: entry.nameId },
        'figureLocations insert failed (non-fatal)',
      )
    }
  }
  return inserted
}

/**
 * Insert `figure_relations` rows for each AI-extracted relation. Target
 * figure is resolved by name; if missing we skip + log (admin curates
 * manually later). Idempotent via composite unique index on
 * (figureId, relatedId, relationType).
 */
async function insertFigureRelations(
  sourceFigureId: string,
  entries: ExtractedRelationEntry[],
  log: JobLogger,
): Promise<number> {
  if (entries.length === 0) return 0
  let inserted = 0
  for (const entry of entries) {
    const targetId = await resolveFigureByName(entry.nameId)
    if (!targetId) {
      log.warn(
        { name: entry.nameId, type: entry.relationType },
        'figureRelations: target figure not found — skipping',
      )
      continue
    }
    if (targetId === sourceFigureId) continue
    try {
      const res = await db
        .insert(figureRelations)
        .values({
          figureId: sourceFigureId,
          relatedId: targetId,
          relationType: entry.relationType,
          notesId: entry.notesId,
        })
        .onConflictDoNothing()
        .returning({ id: figureRelations.id })
      if (res[0]) inserted++
    } catch (err) {
      log.warn(
        { err: (err as Error).message, name: entry.nameId },
        'figureRelations insert failed (non-fatal)',
      )
    }
  }
  return inserted
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
