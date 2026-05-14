// POST /api/v1/admin/figures/discover
//
// "Discover via AI" workflow (Phase 1 of figure discovery):
//
//   Admin memilih KATEGORI (sahabat / tabi'in / nabi / shalih / dst.) +
//   optional gender lock + optional hints. Endpoint ini:
//
//     1. Memuat semua slug + nama figure yang SUDAH ADA di database untuk
//        kategori tersebut (filter gender bila diberikan). Ini set "exclude".
//     2. Mengumpulkan kandidat URL via `searchWhitelist()` dari 30 domain
//        salafi whitelist, mengambil hingga 8 halaman pertama (raw HTML)
//        dipotong 4_000 char/halaman supaya budget context tetap kecil.
//     3. Memanggil `agent` model (DeepSeek V4 Flash default) via
//        `generateObject` dengan schema Zod yang mengembalikan kandidat
//        `{ nameId, nameAr, kunyahId?, laqabId?, shortHint? }` (max 100).
//     4. Server-side dedupe: drop kandidat yang `nameId` atau `nameAr` nya
//        substring-match (case-insensitive trim) salah satu figure existing.
//     5. Log usage ke `ai_usage_logs` supaya cost discovery ikut tercatat.
//
// SINKRON (bukan QStash). Discovery target ~10–20 detik per call. Setelah
// admin pilih nama-nama yang mau dicrawl detail, frontend kirim batch ke
// `/api/v1/admin/figures/ingest/batch` (yang QStash-based) untuk pipeline
// crawl + ekstraksi penuh.
//
// Permission: `figures.create` (sama dengan ingest endpoint).

import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { generateObject } from 'ai'

import { db } from '@athar/db'
import { figureCategories, figures, whitelistDomains } from '@athar/db/schema'
import {
  getActiveModel,
  getModelInstance,
  logUsage,
  calculateCredits,
} from '@athar/ai'

import { ApiError, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { logger } from '@/lib/server/logger'
import {
  fetchPage,
  RateLimitExceededError,
  searchWhitelist,
} from '@/lib/server/research'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── Constants — hard caps ──────────────────────────────────────────────
const MAX_CANDIDATES = 100
const MAX_PAGES = 8
const MAX_CHARS_PER_PAGE = 4_000
const DEFAULT_LIMIT = 30

// Mirror figureCategoryEnum slugs (single source of truth at
// packages/db/src/schema/enums.ts).
const FIGURE_CATEGORY_SLUGS = [
  'nabi',
  'sahabat',
  'tabiin',
  'tabiut_tabiin',
  'shalih_pre_rasul',
  'shalih_pasca_rasul',
] as const

type CategorySlug = (typeof FIGURE_CATEGORY_SLUGS)[number]

// ── Request schema ─────────────────────────────────────────────────────
const discoverRequestSchema = z.object({
  category: z.enum(FIGURE_CATEGORY_SLUGS),
  hints: z.string().trim().max(500).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_CANDIDATES)
    .optional()
    .default(DEFAULT_LIMIT),
  gender: z.enum(['male', 'female']).optional(),
})

// ── LLM response schema ─────────────────────────────────────────────────
const candidateSchema = z.object({
  nameId: z
    .string()
    .min(2)
    .max(160)
    .describe('Nama tokoh dalam transliterasi Indonesia standar.'),
  nameAr: z
    .string()
    .min(2)
    .max(160)
    .describe('Nama tokoh dalam tulisan Arab asli.'),
  kunyahId: z
    .string()
    .max(60)
    .optional()
    .describe('Kunyah (Abu/Umm) transliterasi Indonesia. Opsional.'),
  laqabId: z
    .string()
    .max(120)
    .optional()
    .describe('Laqab/julukan transliterasi Indonesia. Opsional.'),
  shortHint: z
    .string()
    .max(200)
    .optional()
    .describe(
      'Deskripsi 1 baris singkat (gelar, kategori sosial, atau "kemungkinan ada" bila ragu).',
    ),
})

const discoverResponseSchema = z.object({
  candidates: z.array(candidateSchema).max(MAX_CANDIDATES),
})

// ── Helpers ─────────────────────────────────────────────────────────────

const CATEGORY_LABEL_ID: Record<CategorySlug, string> = {
  nabi: 'Nabi & Rasul',
  sahabat: 'Sahabat / Shahabiyat Rasulullah ﷺ',
  tabiin: "Tabi'in",
  tabiut_tabiin: "Tabi'ut Tabi'in (atba' at-tabi'in)",
  shalih_pre_rasul: 'Orang-orang shalih sebelum Nabi Muhammad ﷺ',
  shalih_pasca_rasul: 'Ulama Salaf pasca-Rasul (Imam-imam Ahlus Sunnah)',
}

const CATEGORY_LABEL_AR: Record<CategorySlug, string> = {
  nabi: 'الأنبياء والرسل',
  sahabat: 'الصحابة رضي الله عنهم',
  tabiin: 'التابعون',
  tabiut_tabiin: 'أتباع التابعين',
  shalih_pre_rasul: 'الصالحون قبل البعثة',
  shalih_pasca_rasul: 'أئمة أهل السنة بعد عصر الصحابة',
}

/**
 * Build a single Indonesian + Arabic search query string for the category.
 * The whitelist searcher will fan this out across the 30 domains.
 */
function buildDiscoveryQuery(category: CategorySlug, hints?: string): string {
  const id = `daftar lengkap nama-nama ${CATEGORY_LABEL_ID[category]}`
  const ar = CATEGORY_LABEL_AR[category]
  const hintBit = hints ? ` ${hints}` : ''
  return `${id} ${ar}${hintBit}`.trim()
}

/**
 * Strip HTML tags + collapse whitespace to plain text. Cheap and Good Enough™
 * — we just need keywords for the LLM, not a fidelity-preserving parse.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lowercase + trim + collapse internal whitespace for dedup compare. */
function normaliseName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

interface ExistingFigure {
  nameFullAr: string
  nameFullId: string
}

/**
 * Drop any candidate whose nameId or nameAr substring-matches an existing
 * figure's name (case-insensitive trim). Substring match in BOTH directions
 * to catch "Abu Bakr" vs "Abu Bakr ash-Shiddiq".
 */
function dedupeAgainstExisting<T extends { nameId: string; nameAr: string }>(
  candidates: T[],
  existing: ExistingFigure[],
): T[] {
  if (existing.length === 0) return candidates
  const existingIds = existing.map((e) => normaliseName(e.nameFullId))
  const existingArs = existing.map((e) => normaliseName(e.nameFullAr))
  const out: T[] = []
  for (const c of candidates) {
    const cId = normaliseName(c.nameId)
    const cAr = normaliseName(c.nameAr)
    const idHit = existingIds.some((e) => e && (e.includes(cId) || cId.includes(e)))
    const arHit = existingArs.some((e) => e && (e.includes(cAr) || cAr.includes(e)))
    if (idHit || arHit) continue
    out.push(c)
  }
  return out
}

/** Within-batch dedupe — case-insensitive nameId AND nameAr. */
function dedupeWithinBatch<T extends { nameId: string; nameAr: string }>(
  arr: T[],
): T[] {
  const seenId = new Set<string>()
  const seenAr = new Set<string>()
  const out: T[] = []
  for (const c of arr) {
    const kId = normaliseName(c.nameId)
    const kAr = normaliseName(c.nameAr)
    if (seenId.has(kId) || seenAr.has(kAr)) continue
    seenId.add(kId)
    seenAr.add(kAr)
    out.push(c)
  }
  return out
}

// ── System prompt ───────────────────────────────────────────────────────
const DISCOVERY_SYSTEM_PROMPT = `Kamu adalah asisten riset bibliografi Sirah berbasis manhaj salaf.

Tugasmu: ENUMERASI nama-nama tokoh untuk kategori yang diminta admin, dengan
prinsip:

1. **Manhaj salaf** — fokus pada nama-nama yang diakui dalam tradisi Ahlus
   Sunnah wal Jama'ah. Hindari tokoh-tokoh kontroversial (mu'tazilah,
   khawarij, syiah, tasawuf filosofis, dsb) kecuali admin meminta secara
   eksplisit lewat hints.
2. **Tidak mengarang** — jika sumber dalam SOURCES menyebut nama tokoh,
   masukkan. Jika kamu hanya "samar-samar pernah dengar" tetapi tidak
   ada di sumber dan tidak yakin, JANGAN masukkan. Lebih baik daftar pendek
   yang akurat daripada panjang yang mengarang.
3. **Disclaimer bila ragu** — kalau yakin tokoh real tapi ejaan/nasab kamu
   ragu, masukkan dengan field shortHint diawali "kemungkinan ada — verifikasi".
4. **Hormati EXCLUDE_LIST** — admin sudah punya nama-nama ini di database.
   JANGAN sertakan lagi (cek substring di kedua arah, Arab maupun Indonesia).
5. **Hormati GENDER_LOCK** — kalau admin minta perempuan saja, jangan
   masukkan laki-laki, dan sebaliknya.
6. **Nama Arab utuh** — nameAr harus tulisan Arab asli (bukan transliterasi
   huruf Arab dari ejaan Indonesia). nameId harus transliterasi Indonesia
   standar (mis. "أبو بكر الصديق" → "Abu Bakr ash-Shiddiq").
7. **Kunyah & Laqab opsional** — isi hanya kalau pasti tahu. Jangan tebak.
8. **shortHint** — 1 baris saja, ringkas (mis. "Khalifah pertama, Quraisy",
   "Periwayat hadits dari Bashrah", "Shahabiyat Anshar dari Madinah").

OUTPUT: JSON sesuai schema. Hanya JSON, tanpa prosa pembuka.`

interface BuildPromptInput {
  category: CategorySlug
  hints: string | undefined
  gender: 'male' | 'female' | undefined
  limit: number
  existing: ExistingFigure[]
  sources: { url: string; content: string }[]
}

function buildUserPrompt(input: BuildPromptInput): string {
  const lines: string[] = []
  lines.push(`Kategori target: ${input.category} — ${CATEGORY_LABEL_ID[input.category]}`)
  lines.push(`Kategori dalam bahasa Arab: ${CATEGORY_LABEL_AR[input.category]}`)
  lines.push('')
  if (input.gender) {
    lines.push(
      `GENDER_LOCK: hanya tokoh ${input.gender === 'male' ? 'LAKI-LAKI' : 'PEREMPUAN'}.`,
    )
  } else {
    lines.push('GENDER_LOCK: bebas (boleh laki-laki dan perempuan).')
  }
  if (input.hints) {
    lines.push(`HINTS dari admin: ${input.hints}`)
  }
  lines.push('')
  lines.push(`Target jumlah kandidat: hingga ${input.limit} nama baru.`)
  lines.push('')

  // EXCLUDE_LIST — bullet list of names already in DB.
  if (input.existing.length > 0) {
    lines.push(`EXCLUDE_LIST (${input.existing.length} sudah ada di database):`)
    const sample = input.existing.slice(0, 200) // protect prompt size
    for (const e of sample) {
      lines.push(`- ${e.nameFullId} | ${e.nameFullAr}`)
    }
    if (input.existing.length > sample.length) {
      lines.push(`- … (+${input.existing.length - sample.length} lagi)`)
    }
  } else {
    lines.push('EXCLUDE_LIST: kosong (database belum punya tokoh kategori ini).')
  }
  lines.push('')

  lines.push('SOURCES (kutipan dari domain whitelist salafi — gunakan sebagai bahan enumerasi, bukan sebagai satu-satunya batasan):')
  if (input.sources.length === 0) {
    lines.push('(tidak ada source berhasil di-fetch — andalkan pengetahuan umum kamu tentang nama-nama dalam kategori ini, tetap dengan kaidah manhaj salaf + tidak mengarang.)')
  } else {
    for (const s of input.sources) {
      lines.push('---')
      lines.push(`URL: ${s.url}`)
      lines.push('CONTENT:')
      lines.push(s.content.slice(0, MAX_CHARS_PER_PAGE))
    }
    lines.push('---')
  }
  lines.push('')
  lines.push(
    'Hasilkan daftar kandidat sesuai schema. Pastikan setiap kandidat BELUM ada di EXCLUDE_LIST.',
  )
  return lines.join('\n')
}

// ── Load helpers ────────────────────────────────────────────────────────

/**
 * Resolve `figure_categories.id` for the given slug.  Throws 422 if the
 * row is missing (e.g. seeder hasn't run).
 */
async function resolveCategoryId(slug: CategorySlug): Promise<string> {
  const row = await db.query.figureCategories.findFirst({
    where: and(eq(figureCategories.slug, slug), isNull(figureCategories.deletedAt)),
  })
  if (!row) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Kategori "${slug}" belum diseed di figure_categories. Jalankan seeder dulu.`,
    )
  }
  return row.id
}

/** Load existing figures (nameFullId + nameFullAr) for the EXCLUDE_LIST. */
async function loadExistingFigures(
  categoryId: string,
  gender: 'male' | 'female' | undefined,
): Promise<ExistingFigure[]> {
  const conditions = [
    eq(figures.categoryId, categoryId),
    isNull(figures.deletedAt),
  ]
  if (gender) conditions.push(eq(figures.gender, gender))
  return db
    .select({
      nameFullAr: figures.nameFullAr,
      nameFullId: figures.nameFullId,
    })
    .from(figures)
    .where(and(...conditions))
}

/** Active whitelist domains sorted by priority desc (delegated to searchWhitelist). */
async function loadActiveWhitelist(): Promise<{ domain: string; priority: number }[]> {
  return db
    .select({
      domain: whitelistDomains.domain,
      priority: whitelistDomains.priority,
    })
    .from(whitelistDomains)
    .where(and(eq(whitelistDomains.isActive, true), isNull(whitelistDomains.deletedAt)))
}

/**
 * Fetch up to MAX_PAGES whitelist pages for the discovery query. Soft-fail on
 * individual page errors — discovery is best-effort, the LLM can still rely
 * on its own knowledge if we end up with zero sources.
 */
async function gatherSources(
  query: string,
  log: {
    warn: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  },
): Promise<{ url: string; content: string }[]> {
  const domains = await loadActiveWhitelist()
  if (domains.length === 0) {
    log.warn('whitelist kosong — fallback ke LLM-only discovery')
    return []
  }
  const candidateUrls = await searchWhitelist(query, domains)
  const out: { url: string; content: string }[] = []
  for (const url of candidateUrls) {
    if (out.length >= MAX_PAGES) break
    try {
      const res = await fetchPage(url, { timeoutMs: 10_000, maxAttempts: 1 })
      const text = stripHtml(res.html)
      if (text.length < 200) continue // skip near-empty pages
      out.push({ url: res.finalUrl, content: text })
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        log.warn({ url, retryAfterMs: err.retryAfterMs }, 'rate-limited; skip')
        continue
      }
      log.debug({ url, err: (err as Error).message }, 'fetch failed; skip')
    }
  }
  return out
}

// ── Handler ─────────────────────────────────────────────────────────────

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'figures.create')
  const input = await validateBody(req, discoverRequestSchema)
  const log = logger.child({ route: '/api/v1/admin/figures/discover', userId })
  const startedAt = Date.now()

  // 1. Resolve `agent` model up-front so a misconfigured provider fails
  //    cleanly BEFORE we burn time on HTTP fetches.
  const active = await getActiveModel('agent').catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Model agent tidak tersedia'
    throw new ApiError('CONFLICT', message)
  })
  const model = getModelInstance(active)

  // 2. Load existing figures in this (category, optional gender) — EXCLUDE_LIST.
  const categoryId = await resolveCategoryId(input.category)
  const existing = await loadExistingFigures(categoryId, input.gender)

  // 3. Gather sources from whitelist (best-effort).
  const query = buildDiscoveryQuery(input.category, input.hints)
  const sources = await gatherSources(query, log)

  // 4. Call the LLM with the structured schema.
  //    `maxTokens` scales with the requested limit — each candidate is
  //    ~80-120 tokens (nameAr + nameId + optional kunyah/laqab + shortHint
  //    + JSON braces) so we give ~150 tokens per candidate plus 800 for
  //    JSON scaffolding. Hard floor 4_000, hard ceiling 16_000.
  const dynamicMaxTokens = Math.min(
    16_000,
    Math.max(4_000, 800 + input.limit * 150),
  )
  let llmResult
  try {
    llmResult = await generateObject({
      model,
      schema: discoverResponseSchema,
      system: DISCOVERY_SYSTEM_PROMPT,
      // Force JSON mode rather than tool-call mode — DeepSeek's tool-call
      // schema discipline is weaker than its JSON-mode discipline.
      mode: 'json',
      prompt: buildUserPrompt({
        category: input.category,
        hints: input.hints,
        gender: input.gender,
        limit: input.limit,
        existing,
        sources,
      }),
      temperature: 0.3,
      maxTokens: dynamicMaxTokens,
      maxRetries: 2,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err: message }, 'generateObject failed during discovery')
    // Best-effort: log the failed call so cost monitoring still sees an entry.
    try {
      await logUsage({
        userId,
        role: 'agent',
        providerId: active.provider.id,
        modelId: active.model.id,
        requestType: 'completion',
        inputTokens: 0,
        outputTokens: 0,
        contextSummary: `figure-discover (${input.category}) — FAILED`,
        durationMs: Date.now() - startedAt,
        status: 'error',
        errorMessage: message,
      })
    } catch {
      /* swallow */
    }
    throw new ApiError('EXTERNAL_AI_ERROR', `Discovery gagal: ${message}`)
  }

  // 5. Within-batch dedupe + dedupe against existing DB figures.
  const rawCandidates = (llmResult.object.candidates ?? []).slice(0, input.limit)
  const withinBatch = dedupeWithinBatch(rawCandidates)
  const deduped = dedupeAgainstExisting(withinBatch, existing)

  // 6. Log usage (non-blocking shape, but await here because the route ends).
  try {
    const inputTokens = llmResult.usage?.promptTokens ?? 0
    const outputTokens = llmResult.usage?.completionTokens ?? 0
    const credits = calculateCredits(inputTokens, outputTokens, {
      inputPricePer1m: active.model.inputPricePer1m,
      outputPricePer1m: active.model.outputPricePer1m,
    })
    await logUsage({
      userId,
      role: 'agent',
      providerId: active.provider.id,
      modelId: active.model.id,
      requestType: 'completion',
      inputTokens,
      outputTokens,
      creditsUsed: credits,
      contextSummary: `figure-discover ${input.category}${input.gender ? `/${input.gender}` : ''} → ${deduped.length} new (of ${rawCandidates.length})`,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })
  } catch {
    /* swallow logging failures */
  }

  log.info(
    {
      category: input.category,
      gender: input.gender,
      existingCount: existing.length,
      raw: rawCandidates.length,
      suggestedNew: deduped.length,
      sources: sources.length,
      durationMs: Date.now() - startedAt,
    },
    'discovery complete',
  )

  return ok({
    candidates: deduped,
    existingCount: existing.length,
    suggestedNew: deduped.length,
    sourcesFetched: sources.length,
    modelUsed: active.model.modelId,
    durationMs: Date.now() - startedAt,
  })
})
