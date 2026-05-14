// GET /api/v1/figures/relation?from=<slug>&to=<slug>
//
// Public-read relation checker. Resolves the relationship between two
// figures using a 3-tier strategy:
//   1. Cache lookup in `figure_relation_paths` (30-day TTL).
//   2. BFS over `figure_relations` via `relation-graph.service`.
//   3. AI + websearch fallback (DeepSeek agent + salafi whitelist).
//
// On a successful resolution we INSERT a cache row so subsequent queries
// for the same directed pair skip both the BFS and the AI call.
//
// Auth: optional. The session (if any) is used for usage logging only;
// anonymous callers are accepted. We rate-limit at 30 lookups/hour per
// user via Redis (graceful fallback — `redis` returns 0 on failure so
// the limit becomes a no-op).

import { and, desc, eq, isNull } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod'

import { db } from '@athar/db'
import {
  figureRelationPaths,
  figures,
  whitelistDomains,
  type RelationPathStep,
} from '@athar/db/schema'
import {
  ApiError,
  ok,
  validateQuery,
  withErrorHandling,
} from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { redis } from '@/lib/server/upstash'
import { searchWhitelist } from '@/lib/server/research'
import {
  buildDescription,
  findShortestPath,
} from '@/lib/server/services/relation-graph.service'
import {
  getActiveModel,
  getModelInstance,
  logUsage,
  calculateCredits,
} from '@athar/ai'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

// ─── Query schema ───────────────────────────────────────────────────────
const querySchema = z.object({
  from: z.string().min(1).max(140),
  to: z.string().min(1).max(140),
  /** Force re-resolution even if a fresh cache row exists. Admin-only intent. */
  refresh: z.string().optional(),
})

// ─── Response shape ─────────────────────────────────────────────────────
interface RelationResponse {
  from: { slug: string; nameFullId: string; nameShortId: string | null }
  to: { slug: string; nameFullId: string; nameShortId: string | null }
  relationshipExists: boolean
  resolutionSource: 'db_graph' | 'ai_websearch' | 'none'
  descriptionId: string
  descriptionAr: string | null
  path: RelationPathStep[]
  depth: number
  citationUrl: string | null
  citationDomain: string | null
  confidence: 'high' | 'medium' | 'low'
  cached: boolean
  cachedAt: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────
const CACHE_TTL_DAYS = 30
const RATE_LIMIT_PER_HOUR = 30
const MAX_PATH_DEPTH = 6

// ─── Rate limiter ───────────────────────────────────────────────────────
// Per-user (or per-IP for anonymous) sliding window. Upstash returns 0 on
// quota exhaustion so the limit silently becomes a no-op rather than
// blocking the user — that matches the rest of the codebase's redis usage.

async function reserveRateSlot(scope: string): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000 / 3600)
  const key = `rel-check:rl:${scope}:${bucket}`
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, 3700) // ~1h with slack
  }
  if (count > RATE_LIMIT_PER_HOUR) {
    throw new ApiError(
      'RATE_LIMITED',
      `Batas pengecekan hubungan tercapai (${RATE_LIMIT_PER_HOUR}/jam). Coba lagi dalam beberapa menit.`,
    )
  }
}

// ─── Fresh-cache helpers ────────────────────────────────────────────────
function isFresh(updatedAt: Date): boolean {
  const ageMs = Date.now() - updatedAt.getTime()
  return ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000
}

// ─── Domain extractor for AI citation URLs ──────────────────────────────
function domainOf(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

// ─── AI fallback ────────────────────────────────────────────────────────
const AI_RESPONSE_SCHEMA = z.object({
  relationshipExists: z.boolean(),
  descriptionId: z
    .string()
    .min(2)
    .max(600)
    .optional()
    .describe('Penjelasan ringkas bahasa Indonesia (1-3 kalimat).'),
  descriptionAr: z
    .string()
    .max(600)
    .optional()
    .describe('Penjelasan ringkas bahasa Arab (opsional).'),
  confidence: z.enum(['high', 'medium', 'low']),
  citationUrl: z
    .string()
    .url()
    .optional()
    .describe('URL sumber salafi yang dijadikan rujukan utama.'),
  citationDomain: z.string().max(120).optional(),
})

const AI_SYSTEM_PROMPT = [
  'Kamu adalah pakar sirah salaf yang menjawab pertanyaan tentang HUBUNGAN antara dua tokoh.',
  '',
  'ATURAN (WAJIB):',
  '1. Jawab HANYA berdasarkan fakta yang muncul di sumber yang diberikan user (URL whitelist salafi).',
  '   Jika tidak ada sumber yang menyebutkan hubungan keduanya, set relationshipExists=false.',
  '2. Jangan pakai pengetahuan luar. Tebakan ditolak.',
  '3. descriptionId: 1-3 kalimat bahasa Indonesia yang jelas — sebutkan jenis hubungan',
  '   (anak, paman, guru, murid, sezaman, dst.) dan, jika relevan, melalui siapa.',
  '4. confidence: "high" hanya jika sumber eksplisit; "medium" jika tersirat; "low" jika',
  '   hanya satu sumber lemah atau bahasanya ambigu.',
  '5. citationUrl: URL dari salah satu sumber yang diberikan — jangan mengarang URL.',
  '6. Jangan menyebut nama madzhab atau aliran. Fokus pada fakta nasab / guru-murid / sahabat.',
].join('\n')

interface AiContext {
  fromName: string
  fromNameAr: string
  toName: string
  toNameAr: string
}

interface AiResult {
  relationshipExists: boolean
  descriptionId: string
  descriptionAr: string | null
  confidence: 'high' | 'medium' | 'low'
  citationUrl: string | null
  citationDomain: string | null
  /** Track for usage logging. */
  meta: {
    modelUsed: string
    durationMs: number
    inputTokens: number
    outputTokens: number
    creditsUsed: number
    providerId: string
    modelDbId: string
  } | null
}

/**
 * Run the AI fallback. Returns a structured answer plus usage metadata.
 *
 * On any error (AI provider down, no whitelist domains configured, etc.)
 * we return a "no relationship found" stub with confidence='low' so the
 * caller can still cache + render *something*. The error is swallowed but
 * the cache row will be marked `resolution_source='none'` so the
 * next-day cache refresh will retry naturally.
 */
async function runAiFallback(ctx: AiContext): Promise<AiResult> {
  // 1. Fetch whitelist URLs to feed the model.
  const domains = await db
    .select({
      domain: whitelistDomains.domain,
      priority: whitelistDomains.priority,
    })
    .from(whitelistDomains)
    .where(
      and(eq(whitelistDomains.isActive, true), isNull(whitelistDomains.deletedAt)),
    )

  // Query both names together so search engines surface co-occurrence pages.
  const candidateUrls = await searchWhitelist(
    `${ctx.fromName} ${ctx.toName}`,
    domains,
  )

  // 2. Call the agent model.
  let active
  try {
    active = await getActiveModel('agent')
  } catch (err) {
    console.warn('[relation-checker] agent model unavailable', err)
    return fallbackStub()
  }
  const model = getModelInstance(active)

  const prompt = [
    `Tokoh 1 (FROM): ${ctx.fromName} (${ctx.fromNameAr || '—'})`,
    `Tokoh 2 (TO):   ${ctx.toName} (${ctx.toNameAr || '—'})`,
    '',
    'PERTANYAAN: Apa hubungan antara kedua tokoh ini menurut sirah salaf?',
    'Jenis hubungan yang mungkin: anak/ayah/ibu, saudara, paman/keponakan, sepupu,',
    'kakek/cucu, suami/istri, guru/murid, sahabat seangkatan, sezaman, atau tidak ada hubungan.',
    '',
    'KANDIDAT URL SUMBER (whitelist salafi — gunakan ini sebagai rujukan):',
    candidateUrls.slice(0, 12).map((u) => `- ${u}`).join('\n') || '(tidak ada — jawab relationshipExists=false jika kamu tidak yakin)',
  ].join('\n')

  const startedAt = Date.now()
  try {
    const result = await generateObject({
      model,
      schema: AI_RESPONSE_SCHEMA,
      system: AI_SYSTEM_PROMPT,
      prompt,
      temperature: 0.2,
      maxTokens: 600,
      maxRetries: 1,
    })

    const inputTokens = result.usage?.promptTokens ?? 0
    const outputTokens = result.usage?.completionTokens ?? 0
    const credits = calculateCredits(inputTokens, outputTokens, {
      inputPricePer1m: active.model.inputPricePer1m,
      outputPricePer1m: active.model.outputPricePer1m,
    })

    const o = result.object
    const citationDomain = o.citationDomain ?? domainOf(o.citationUrl ?? null)
    return {
      relationshipExists: o.relationshipExists,
      descriptionId:
        o.descriptionId ??
        (o.relationshipExists
          ? `${ctx.fromName} memiliki hubungan dengan ${ctx.toName} (rincian belum dapat dipastikan dari sumber).`
          : `Tidak ditemukan hubungan langsung antara ${ctx.fromName} dan ${ctx.toName} dalam catatan salaf.`),
      descriptionAr: o.descriptionAr ?? null,
      confidence: o.confidence,
      citationUrl: o.citationUrl ?? null,
      citationDomain: citationDomain ?? null,
      meta: {
        modelUsed: active.model.modelId,
        durationMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        creditsUsed: credits,
        providerId: active.provider.id,
        modelDbId: active.model.id,
      },
    }
  } catch (err) {
    console.warn('[relation-checker] generateObject failed', err)
    return fallbackStub()
  }
}

function fallbackStub(): AiResult {
  return {
    relationshipExists: false,
    descriptionId:
      'Tidak ditemukan hubungan langsung dalam catatan salaf (sumber AI tidak tersedia saat ini).',
    descriptionAr: null,
    confidence: 'low',
    citationUrl: null,
    citationDomain: null,
    meta: null,
  }
}

// ─── Resolver (used by both GET and the bulk endpoint) ──────────────────
// Exported so /api/v1/figures/relation/bulk can reuse the same code path
// without re-implementing the cache + BFS + AI ladder.

export interface ResolveInput {
  fromId: string
  fromSlug: string
  fromNameFullId: string
  fromNameFullAr: string
  fromNameShortId: string | null
  toId: string
  toSlug: string
  toNameFullId: string
  toNameFullAr: string
  toNameShortId: string | null
}

export async function resolveRelation(
  input: ResolveInput,
  userId: string | null,
  options: { refresh?: boolean } = {},
): Promise<RelationResponse> {
  // 1. Cache lookup (unless force-refresh).
  if (!options.refresh) {
    const cached = await db
      .select()
      .from(figureRelationPaths)
      .where(
        and(
          eq(figureRelationPaths.fromFigureId, input.fromId),
          eq(figureRelationPaths.toFigureId, input.toId),
          isNull(figureRelationPaths.deletedAt),
        ),
      )
      .orderBy(desc(figureRelationPaths.updatedAt))
      .limit(1)

    const hit = cached[0]
    if (hit && isFresh(hit.updatedAt)) {
      return shapeResponse(input, hit, true)
    }
  }

  // 2. Graph walk.
  const graph = await findShortestPath(input.fromId, input.toId, MAX_PATH_DEPTH)
  if (graph.found) {
    const descriptionId = buildDescription(graph.steps)
    const inserted = await upsertCache({
      fromId: input.fromId,
      toId: input.toId,
      resolutionSource: 'db_graph',
      descriptionId,
      descriptionAr: null,
      pathJson: graph.steps,
      citationUrl: null,
      citationDomain: null,
      confidence: 'high',
    })
    return shapeResponse(input, inserted, false)
  }

  // 3. AI fallback.
  const ai = await runAiFallback({
    fromName: input.fromNameFullId,
    fromNameAr: input.fromNameFullAr,
    toName: input.toNameFullId,
    toNameAr: input.toNameFullAr,
  })

  // Log usage best-effort.
  if (ai.meta) {
    try {
      await logUsage({
        userId,
        role: 'agent',
        providerId: ai.meta.providerId,
        modelId: ai.meta.modelDbId,
        requestType: 'completion',
        inputTokens: ai.meta.inputTokens,
        outputTokens: ai.meta.outputTokens,
        creditsUsed: ai.meta.creditsUsed,
        contextSummary: `relation-check ${input.fromSlug}→${input.toSlug}`,
        durationMs: ai.meta.durationMs,
        status: 'success',
      })
    } catch {
      /* swallow */
    }
  }

  const inserted = await upsertCache({
    fromId: input.fromId,
    toId: input.toId,
    resolutionSource: ai.relationshipExists ? 'ai_websearch' : 'none',
    descriptionId: ai.descriptionId,
    descriptionAr: ai.descriptionAr,
    pathJson: [], // AI fallback rarely produces a real path.
    citationUrl: ai.citationUrl,
    citationDomain: ai.citationDomain,
    confidence: ai.confidence,
  })
  return shapeResponse(input, inserted, false)
}

// ─── Cache upsert ───────────────────────────────────────────────────────
type CacheRow = typeof figureRelationPaths.$inferSelect

interface CacheInsertArgs {
  fromId: string
  toId: string
  resolutionSource: 'db_graph' | 'ai_websearch' | 'none'
  descriptionId: string
  descriptionAr: string | null
  pathJson: RelationPathStep[]
  citationUrl: string | null
  citationDomain: string | null
  confidence: 'high' | 'medium' | 'low'
}

async function upsertCache(args: CacheInsertArgs): Promise<CacheRow> {
  // Try insert first — if a stale row exists (deleted_at IS NULL but past
  // TTL) the partial unique index will conflict. Fall back to UPDATE.
  try {
    const inserted = await db
      .insert(figureRelationPaths)
      .values({
        fromFigureId: args.fromId,
        toFigureId: args.toId,
        resolutionSource: args.resolutionSource,
        descriptionId: args.descriptionId,
        descriptionAr: args.descriptionAr,
        pathJson: args.pathJson,
        citationUrl: args.citationUrl,
        citationDomain: args.citationDomain,
        confidence: args.confidence,
      })
      .returning()
    if (inserted[0]) return inserted[0]
  } catch {
    // Fall through to update path.
  }

  // Refresh existing row in place so cache TTL resets.
  const updated = await db
    .update(figureRelationPaths)
    .set({
      resolutionSource: args.resolutionSource,
      descriptionId: args.descriptionId,
      descriptionAr: args.descriptionAr,
      pathJson: args.pathJson,
      citationUrl: args.citationUrl,
      citationDomain: args.citationDomain,
      confidence: args.confidence,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(figureRelationPaths.fromFigureId, args.fromId),
        eq(figureRelationPaths.toFigureId, args.toId),
        isNull(figureRelationPaths.deletedAt),
      ),
    )
    .returning()
  if (updated[0]) return updated[0]

  // Last-ditch: synthesise a row in memory so the response can render.
  return {
    id: '00000000-0000-0000-0000-000000000000',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: null,
    updatedBy: null,
    deletedAt: null,
    deletedBy: null,
    fromFigureId: args.fromId,
    toFigureId: args.toId,
    resolutionSource: args.resolutionSource,
    descriptionId: args.descriptionId,
    descriptionAr: args.descriptionAr,
    pathJson: args.pathJson,
    citationUrl: args.citationUrl,
    citationDomain: args.citationDomain,
    confidence: args.confidence,
  } as CacheRow
}

// ─── Shape ──────────────────────────────────────────────────────────────
function shapeResponse(
  input: ResolveInput,
  row: CacheRow,
  cached: boolean,
): RelationResponse {
  const path = (row.pathJson ?? []) as RelationPathStep[]
  return {
    from: {
      slug: input.fromSlug,
      nameFullId: input.fromNameFullId,
      nameShortId: input.fromNameShortId,
    },
    to: {
      slug: input.toSlug,
      nameFullId: input.toNameFullId,
      nameShortId: input.toNameShortId,
    },
    relationshipExists: row.resolutionSource !== 'none',
    resolutionSource: row.resolutionSource as RelationResponse['resolutionSource'],
    descriptionId: row.descriptionId,
    descriptionAr: row.descriptionAr,
    path,
    depth: Math.max(0, path.length - 1),
    citationUrl: row.citationUrl,
    citationDomain: row.citationDomain,
    confidence: row.confidence as RelationResponse['confidence'],
    cached,
    cachedAt: cached ? row.updatedAt.toISOString() : null,
  }
}

// ─── Helpers for slug → figure resolution ───────────────────────────────
export interface ResolvedFigureMini {
  id: string
  slug: string
  nameFullId: string
  nameFullAr: string
  nameShortId: string | null
}

export async function resolveFigureBySlug(slug: string): Promise<ResolvedFigureMini> {
  const rows = await db
    .select({
      id: figures.id,
      slug: figures.slug,
      nameFullId: figures.nameFullId,
      nameFullAr: figures.nameFullAr,
      nameShortId: figures.nameShortId,
    })
    .from(figures)
    .where(and(eq(figures.slug, slug), isNull(figures.deletedAt)))
    .limit(1)
  const row = rows[0]
  if (!row) {
    throw new ApiError('NOT_FOUND', `Tokoh tidak ditemukan: ${slug}`)
  }
  return row
}

// ─── GET handler ────────────────────────────────────────────────────────
export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url)
  const { from, to, refresh } = validateQuery(url.searchParams, querySchema)

  if (from === to) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Pilih dua tokoh yang berbeda untuk dicek hubungannya.',
    )
  }

  // Optional auth — used only for rate-limit scoping + usage logging.
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id ?? null

  // Rate-limit scope: prefer userId, fall back to IP-ish header.
  const ipHint =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anon'
  const rateScope = userId ?? `ip:${ipHint}`
  await reserveRateSlot(rateScope)

  // Resolve both endpoints in parallel.
  const [fromFig, toFig] = await Promise.all([
    resolveFigureBySlug(from),
    resolveFigureBySlug(to),
  ])

  const result = await resolveRelation(
    {
      fromId: fromFig.id,
      fromSlug: fromFig.slug,
      fromNameFullId: fromFig.nameFullId,
      fromNameFullAr: fromFig.nameFullAr,
      fromNameShortId: fromFig.nameShortId,
      toId: toFig.id,
      toSlug: toFig.slug,
      toNameFullId: toFig.nameFullId,
      toNameFullAr: toFig.nameFullAr,
      toNameShortId: toFig.nameShortId,
    },
    userId,
    { refresh: refresh === '1' || refresh === 'true' },
  )

  return ok(result)
})

