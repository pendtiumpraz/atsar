// Figure & battle ingest service — reusable helpers that both the
// `/api/v1/admin/figures/*` HTTP routes and the AI chat write tools call.
//
// Why a service: the AI chat needs to invoke "discover candidates" +
// "create research_jobs row + publish QStash + dedup against recent jobs"
// from a tool's `execute()` without paying the cost of an internal HTTP
// round-trip. Extracting the logic here keeps a single source of truth so
// route + tool stay in sync.
//
// Each function is a thin wrapper over the existing route logic; the route
// files still own request validation + permission gates. Callers from the
// chat tool layer must enforce auth themselves (see chat-tools.ts).

import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'
import { generateObject } from 'ai'
import { z } from 'zod'

import { db } from '@athar/db'
import {
  battles,
  figureCategories,
  figures,
  researchJobs,
  whitelistDomains,
} from '@athar/db/schema'
import {
  getActiveModel,
  getModelInstance,
  logUsage,
  calculateCredits,
} from '@athar/ai'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'
import {
  fetchPage,
  RateLimitExceededError,
  searchWhitelist,
} from '@/lib/server/research'

// ── Shared types ────────────────────────────────────────────────────────

export type FigureCategorySlug =
  | 'nabi'
  | 'sahabat'
  | 'tabiin'
  | 'tabiut_tabiin'
  | 'shalih_pre_rasul'
  | 'shalih_pasca_rasul'

export type BattleType = 'ghazwah' | 'sariyyah' | 'futuhat'

export interface FigureIngestItem {
  name: string
  category: FigureCategorySlug
  gender?: 'male' | 'female'
  hints?: string
}

export interface BattleIngestItem {
  name: string
  type?: BattleType
  hints?: string
}

export interface IngestFailure {
  name: string
  reason: string
}

export interface ReingestFailure {
  slug: string
  reason: string
}

export interface BatchIngestResult {
  created: number
  queued: number
  failures: IngestFailure[]
}

export interface BatchReingestResult {
  created: number
  queued: number
  failures: ReingestFailure[]
}

// ── Single-figure ingest ────────────────────────────────────────────────
//
// Insert one `research_jobs` row + publish QStash. Returns the job id.
// Mirrors `POST /api/v1/admin/figures/ingest` minus the route plumbing.

export async function ingestFigure(
  userId: string,
  input: FigureIngestItem,
): Promise<{ jobId: string; messageId: string | null; publishError: string | null }> {
  const log = logger.child({ service: 'figure-ingest.ingestFigure', userId })

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
    throw new Error('Insert research_jobs returned no row')
  }

  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'figure_ingest', jobId: job.id },
      { deduplicationId: `figure-ingest:${job.id}` },
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
      'QStash publish failed — job left pending',
    )
  }

  return { jobId: job.id, messageId, publishError }
}

// ── Batch figure ingest ─────────────────────────────────────────────────
//
// Insert N research_jobs rows in a single db.batch + publish QStash for
// each (best-effort). Mirrors the batch route handler.

export async function ingestFiguresBatch(
  userId: string,
  items: FigureIngestItem[],
): Promise<BatchIngestResult> {
  const log = logger.child({ service: 'figure-ingest.ingestFiguresBatch', userId })
  const failures: IngestFailure[] = []

  // ── 1. De-dup within batch (category::name lowercased). ──
  const seen = new Set<string>()
  const candidates: FigureIngestItem[] = []
  for (const raw of items) {
    const key = `${raw.category}::${raw.name.toLowerCase()}`
    if (seen.has(key)) {
      failures.push({ name: raw.name, reason: 'duplikat dalam batch' })
      continue
    }
    seen.add(key)
    candidates.push(raw)
  }

  // ── 2. De-dup against recent (last hour) pending/running ingests. ──
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await db
    .select({ payload: researchJobs.payload })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.type, 'figure_ingest'),
        gte(researchJobs.createdAt, hourAgo),
        sql`${researchJobs.status} IN ('pending', 'running')`,
      ),
    )
  const recentKeys = new Set<string>()
  for (const row of recent) {
    const p = row.payload as { name?: string; category?: string } | null
    if (p?.name && p.category) {
      recentKeys.add(`${p.category}::${p.name.toLowerCase()}`)
    }
  }

  const toInsert = candidates.filter((c) => {
    const key = `${c.category}::${c.name.toLowerCase()}`
    if (recentKeys.has(key)) {
      failures.push({
        name: c.name,
        reason: 'job baru saja diantrekan (< 1 jam terakhir)',
      })
      return false
    }
    return true
  })

  if (toInsert.length === 0) {
    return { created: 0, queued: 0, failures }
  }

  // ── 3. db.batch INSERT — Neon HTTP. ──
  const insertStatements = toInsert.map((c) =>
    db
      .insert(researchJobs)
      .values({
        type: 'figure_ingest',
        status: 'pending',
        payload: c,
        createdBy: userId,
      })
      .returning({ id: researchJobs.id }),
  )

  const batchResults = (await db.batch(
    insertStatements as [
      (typeof insertStatements)[number],
      ...(typeof insertStatements)[number][],
    ],
  )) as Array<Array<{ id: string }>>

  const created = batchResults
    .map((r, i) => ({ jobId: r[0]?.id ?? null, item: toInsert[i]! }))
    .filter((r) => r.jobId !== null) as Array<{
    jobId: string
    item: FigureIngestItem
  }>

  // ── 4. Publish QStash — settle-all. ──
  const publishResults = await Promise.allSettled(
    created.map(({ jobId }) =>
      publishJob(
        'research',
        { type: 'figure_ingest', jobId },
        { deduplicationId: `figure-ingest:${jobId}` },
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
        name: row.item.name,
        reason: `QStash publish gagal: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      })
    }
  }
  if (messageUpdates.length > 0) {
    await Promise.allSettled(messageUpdates)
  }

  log.info(
    { created: created.length, queued, failures: failures.length },
    'batch figure ingest complete',
  )

  return { created: created.length, queued, failures }
}

// ── Single figure re-ingest ─────────────────────────────────────────────

export interface FigureReingestInput {
  slug: string
  mode?: 'enrich' | 'replace'
  focusFields?: string[]
  hints?: string
}

export async function reingestFigure(
  userId: string,
  input: FigureReingestInput,
): Promise<{
  jobId: string
  figureId: string
  mode: 'enrich' | 'replace'
  messageId: string | null
  publishError: string | null
}> {
  const log = logger.child({ service: 'figure-ingest.reingestFigure', userId })
  const mode = input.mode ?? 'enrich'

  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, input.slug), isNull(figures.deletedAt)),
  })
  if (!figure) {
    throw new Error(`Tokoh tidak ditemukan: ${input.slug}`)
  }

  const category = await db.query.figureCategories.findFirst({
    where: eq(figureCategories.id, figure.categoryId),
    columns: { slug: true },
  })
  if (!category) {
    throw new Error('Kategori tokoh tidak ditemukan — data inkonsisten.')
  }

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
  const payload = {
    figureId: figure.id,
    slug: figure.slug,
    name: figure.nameFullAr || figure.nameFullId,
    categorySlug: category.slug,
    mode,
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
    throw new Error('Gagal membuat job re-ingest.')
  }

  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'figure_reingest', jobId: job.id },
      { deduplicationId: `figure-reingest:${figure.id}:${job.id}` },
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
      'QStash publish failed — re-ingest job left pending',
    )
  }

  return {
    jobId: job.id,
    figureId: figure.id,
    mode,
    messageId,
    publishError,
  }
}

// ── Batch figure re-ingest ──────────────────────────────────────────────

export interface FigureReingestBatchInput {
  slugs: string[]
  mode?: 'enrich' | 'replace'
  focusFields?: string[]
  hints?: string
}

export async function reingestFiguresBatch(
  userId: string,
  input: FigureReingestBatchInput,
): Promise<BatchReingestResult> {
  const log = logger.child({ service: 'figure-ingest.reingestFiguresBatch', userId })
  const failures: ReingestFailure[] = []
  const mode = input.mode ?? 'enrich'

  // ── 1. De-dup within batch. ──
  const seen = new Set<string>()
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
    return { created: 0, queued: 0, failures }
  }

  // ── 2. Resolve figures + category slugs. ──
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
    return { created: 0, queued: 0, failures }
  }

  // ── 3. De-dup against recent (last hour) re-ingest jobs. ──
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
    return { created: 0, queued: 0, failures }
  }

  // ── 4. Insert all rows via db.batch. ──
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
      mode,
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

  // ── 5. Publish QStash messages. ──
  const publishResults = await Promise.allSettled(
    created.map(({ jobId, figure }) =>
      publishJob(
        'research',
        { type: 'figure_reingest', jobId },
        { deduplicationId: `figure-reingest:${figure.id}:${jobId}` },
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
    'batch figure re-ingest complete',
  )

  return { created: created.length, queued, failures }
}

// ── Single battle ingest ────────────────────────────────────────────────

export async function ingestBattle(
  userId: string,
  input: BattleIngestItem,
): Promise<{ jobId: string; messageId: string | null; publishError: string | null }> {
  const log = logger.child({ service: 'figure-ingest.ingestBattle', userId })

  const [job] = await db
    .insert(researchJobs)
    .values({
      type: 'battle_ingest',
      status: 'pending',
      payload: input,
      createdBy: userId,
    })
    .returning({ id: researchJobs.id })

  if (!job) {
    throw new Error('Insert research_jobs returned no row')
  }

  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'battle_ingest', jobId: job.id },
      { deduplicationId: `battle-ingest:${job.id}` },
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
      'QStash publish failed — battle ingest left pending',
    )
  }

  return { jobId: job.id, messageId, publishError }
}

// ── Batch battle ingest ─────────────────────────────────────────────────

export async function ingestBattlesBatch(
  userId: string,
  items: BattleIngestItem[],
): Promise<BatchIngestResult> {
  const log = logger.child({ service: 'figure-ingest.ingestBattlesBatch', userId })
  const failures: IngestFailure[] = []

  const seen = new Set<string>()
  const candidates: BattleIngestItem[] = []
  for (const raw of items) {
    const key = raw.name.toLowerCase()
    if (seen.has(key)) {
      failures.push({ name: raw.name, reason: 'duplikat dalam batch' })
      continue
    }
    seen.add(key)
    candidates.push(raw)
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recent = await db
    .select({ payload: researchJobs.payload })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.type, 'battle_ingest'),
        gte(researchJobs.createdAt, hourAgo),
        sql`${researchJobs.status} IN ('pending', 'running')`,
      ),
    )
  const recentKeys = new Set<string>()
  for (const row of recent) {
    const p = row.payload as { name?: string } | null
    if (p?.name) recentKeys.add(p.name.toLowerCase())
  }

  const toInsert = candidates.filter((c) => {
    if (recentKeys.has(c.name.toLowerCase())) {
      failures.push({
        name: c.name,
        reason: 'job baru saja diantrekan (< 1 jam terakhir)',
      })
      return false
    }
    return true
  })

  if (toInsert.length === 0) {
    return { created: 0, queued: 0, failures }
  }

  const insertStatements = toInsert.map((c) =>
    db
      .insert(researchJobs)
      .values({
        type: 'battle_ingest',
        status: 'pending',
        payload: c,
        createdBy: userId,
      })
      .returning({ id: researchJobs.id }),
  )

  const batchResults = (await db.batch(
    insertStatements as [
      (typeof insertStatements)[number],
      ...(typeof insertStatements)[number][],
    ],
  )) as Array<Array<{ id: string }>>

  const created = batchResults
    .map((r, i) => ({ jobId: r[0]?.id ?? null, item: toInsert[i]! }))
    .filter((r) => r.jobId !== null) as Array<{
    jobId: string
    item: BattleIngestItem
  }>

  const publishResults = await Promise.allSettled(
    created.map(({ jobId }) =>
      publishJob(
        'research',
        { type: 'battle_ingest', jobId },
        { deduplicationId: `battle-ingest:${jobId}` },
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
        name: row.item.name,
        reason: `QStash publish gagal: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      })
    }
  }
  if (messageUpdates.length > 0) {
    await Promise.allSettled(messageUpdates)
  }

  log.info(
    { created: created.length, queued, failures: failures.length },
    'batch battle ingest complete',
  )

  return { created: created.length, queued, failures }
}

// ── Single battle re-ingest ─────────────────────────────────────────────

export interface BattleReingestInput {
  slug: string
  mode?: 'enrich' | 'replace'
  focusFields?: string[]
  hints?: string
}

export async function reingestBattle(
  userId: string,
  input: BattleReingestInput,
): Promise<{
  jobId: string
  battleId: string
  mode: 'enrich' | 'replace'
  messageId: string | null
  publishError: string | null
}> {
  const log = logger.child({ service: 'figure-ingest.reingestBattle', userId })
  const mode = input.mode ?? 'enrich'

  const battle = await db.query.battles.findFirst({
    where: and(eq(battles.slug, input.slug), isNull(battles.deletedAt)),
  })
  if (!battle) {
    throw new Error(`Sirah perang tidak ditemukan: ${input.slug}`)
  }

  const originalSnapshot = {
    id: battle.id,
    slug: battle.slug,
    nameAr: battle.nameAr,
    nameId: battle.nameId,
    type: battle.type,
    eventDateAh: battle.eventDateAh,
    eventDateCe: battle.eventDateCe,
    eventDatePrecision: battle.eventDatePrecision,
    eventDateNotes: battle.eventDateNotes,
    opponentForce: battle.opponentForce,
    muslimCount: battle.muslimCount,
    opponentCount: battle.opponentCount,
    outcome: battle.outcome,
    casualtiesMuslim: battle.casualtiesMuslim,
    casualtiesOpponent: battle.casualtiesOpponent,
    strategyId: battle.strategyId,
    narrativeId: battle.narrativeId,
    significanceId: battle.significanceId,
  }
  const payload = {
    battleId: battle.id,
    slug: battle.slug,
    name: battle.nameAr || battle.nameId,
    type: battle.type,
    mode,
    focusFields: input.focusFields ?? [],
    hints: input.hints,
    originalSnapshot,
  }

  const [job] = await db
    .insert(researchJobs)
    .values({
      type: 'battle_reingest',
      status: 'pending',
      payload,
      createdBy: userId,
    })
    .returning({ id: researchJobs.id })
  if (!job) {
    throw new Error('Gagal membuat job re-ingest battle.')
  }

  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'battle_reingest', jobId: job.id },
      { deduplicationId: `battle-reingest:${battle.id}:${job.id}` },
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
      'QStash publish failed — battle re-ingest left pending',
    )
  }

  return {
    jobId: job.id,
    battleId: battle.id,
    mode,
    messageId,
    publishError,
  }
}

// ── Discover figures (Phase 1 enumeration) ──────────────────────────────
//
// Mirrors `POST /api/v1/admin/figures/discover`. Synchronous — fetches up
// to 8 whitelist pages + calls `generateObject` to enumerate candidates.
// Best-effort: a missing AI provider raises; a failed page fetch is swallowed.

const FIGURE_CATEGORY_LABEL_ID: Record<FigureCategorySlug, string> = {
  nabi: 'Nabi & Rasul',
  sahabat: 'Sahabat / Shahabiyat Rasulullah ﷺ',
  tabiin: "Tabi'in",
  tabiut_tabiin: "Tabi'ut Tabi'in (atba' at-tabi'in)",
  shalih_pre_rasul: 'Orang-orang shalih sebelum Nabi Muhammad ﷺ',
  shalih_pasca_rasul: 'Ulama Salaf pasca-Rasul (Imam-imam Ahlus Sunnah)',
}

const FIGURE_CATEGORY_LABEL_AR: Record<FigureCategorySlug, string> = {
  nabi: 'الأنبياء والرسل',
  sahabat: 'الصحابة رضي الله عنهم',
  tabiin: 'التابعون',
  tabiut_tabiin: 'أتباع التابعين',
  shalih_pre_rasul: 'الصالحون قبل البعثة',
  shalih_pasca_rasul: 'أئمة أهل السنة بعد عصر الصحابة',
}

const DISCOVERY_SYSTEM_PROMPT = `Kamu adalah asisten riset bibliografi Sirah berbasis manhaj salaf.

Tugasmu: ENUMERASI nama-nama tokoh untuk kategori yang diminta admin, dengan
prinsip:

1. **Manhaj salaf** — fokus pada nama-nama yang diakui dalam tradisi Ahlus
   Sunnah wal Jama'ah. Hindari tokoh-tokoh kontroversial (mu'tazilah,
   khawarij, syiah, tasawuf filosofis, dsb) kecuali admin meminta secara
   eksplisit lewat hints.
2. **Tidak mengarang** — jika sumber dalam SOURCES menyebut nama tokoh,
   masukkan. Jika kamu hanya "samar-samar pernah dengar" tetapi tidak
   ada di sumber dan tidak yakin, JANGAN masukkan.
3. **Disclaimer bila ragu** — kalau yakin tokoh real tapi ejaan/nasab kamu
   ragu, masukkan dengan field shortHint diawali "kemungkinan ada — verifikasi".
4. **Hormati EXCLUDE_LIST** — admin sudah punya nama-nama ini di database.
   JANGAN sertakan lagi (cek substring di kedua arah, Arab maupun Indonesia).
5. **Hormati GENDER_LOCK** — kalau admin minta perempuan saja, jangan
   masukkan laki-laki, dan sebaliknya.
6. **Nama Arab utuh** — nameAr harus tulisan Arab asli (bukan transliterasi
   huruf Arab dari ejaan Indonesia). nameId harus transliterasi Indonesia
   standar.
7. **Kunyah & Laqab opsional** — isi hanya kalau pasti tahu. Jangan tebak.
8. **shortHint** — 1 baris saja, ringkas.

OUTPUT: JSON sesuai schema. Hanya JSON, tanpa prosa pembuka.`

const MAX_DISCOVER_CANDIDATES = 100
const MAX_DISCOVER_PAGES = 8
const MAX_DISCOVER_CHARS_PER_PAGE = 4_000
const DEFAULT_DISCOVER_LIMIT = 30

const discoverFigureCandidateSchema = z.object({
  nameId: z.string().min(2).max(160),
  nameAr: z.string().min(2).max(160),
  kunyahId: z.string().max(60).optional(),
  laqabId: z.string().max(120).optional(),
  shortHint: z.string().max(200).optional(),
})

const discoverFigureResponseSchema = z.object({
  candidates: z.array(discoverFigureCandidateSchema).max(MAX_DISCOVER_CANDIDATES),
})

export interface FigureDiscoveryInput {
  category: FigureCategorySlug
  gender?: 'male' | 'female'
  hints?: string
  limit?: number
}

export interface FigureDiscoveryCandidate {
  nameId: string
  nameAr: string
  kunyahId?: string
  laqabId?: string
  shortHint?: string
}

export interface FigureDiscoveryResult {
  candidates: FigureDiscoveryCandidate[]
  existingCount: number
  suggestedNew: number
  sourcesFetched: number
  modelUsed: string
  durationMs: number
}

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

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

interface ExistingFigure {
  nameFullAr: string
  nameFullId: string
}

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

/**
 * Enumerate candidate figures for a category (Phase 1). Returns names
 * NOT already present in the DB. Used by both the discover HTTP route and
 * the AI chat `discover_figures` tool.
 */
export async function discoverFigureCandidates(
  userId: string,
  input: FigureDiscoveryInput,
): Promise<FigureDiscoveryResult> {
  const log = logger.child({ service: 'figure-ingest.discoverFigureCandidates', userId })
  const startedAt = Date.now()
  const limit = Math.min(
    Math.max(input.limit ?? DEFAULT_DISCOVER_LIMIT, 1),
    MAX_DISCOVER_CANDIDATES,
  )

  // 1. Resolve `agent` model up-front.
  const active = await getActiveModel('agent')
  const model = getModelInstance(active)

  // 2. Resolve category id + existing figures (EXCLUDE_LIST).
  const categoryRow = await db.query.figureCategories.findFirst({
    where: and(
      eq(figureCategories.slug, input.category),
      isNull(figureCategories.deletedAt),
    ),
  })
  if (!categoryRow) {
    throw new Error(`Kategori "${input.category}" belum diseed.`)
  }
  const categoryId = categoryRow.id

  const existingConds = [
    eq(figures.categoryId, categoryId),
    isNull(figures.deletedAt),
  ]
  if (input.gender) existingConds.push(eq(figures.gender, input.gender))
  const existing = await db
    .select({
      nameFullAr: figures.nameFullAr,
      nameFullId: figures.nameFullId,
    })
    .from(figures)
    .where(and(...existingConds))

  // 3. Gather sources (best-effort).
  const id = `daftar lengkap nama-nama ${FIGURE_CATEGORY_LABEL_ID[input.category]}`
  const ar = FIGURE_CATEGORY_LABEL_AR[input.category]
  const hintBit = input.hints ? ` ${input.hints}` : ''
  const query = `${id} ${ar}${hintBit}`.trim()

  const domains = await db
    .select({
      domain: whitelistDomains.domain,
      priority: whitelistDomains.priority,
    })
    .from(whitelistDomains)
    .where(and(eq(whitelistDomains.isActive, true), isNull(whitelistDomains.deletedAt)))

  const sources: { url: string; content: string }[] = []
  if (domains.length > 0) {
    const urls = await searchWhitelist(query, domains)
    for (const url of urls) {
      if (sources.length >= MAX_DISCOVER_PAGES) break
      try {
        const res = await fetchPage(url, { timeoutMs: 10_000, maxAttempts: 1 })
        const text = stripHtml(res.html)
        if (text.length < 200) continue
        sources.push({ url: res.finalUrl, content: text })
      } catch (err) {
        if (err instanceof RateLimitExceededError) continue
        log.debug({ url, err: (err as Error).message }, 'fetch failed; skip')
      }
    }
  }

  // 4. Build prompt + call generateObject.
  const promptLines: string[] = []
  promptLines.push(`Kategori target: ${input.category} — ${FIGURE_CATEGORY_LABEL_ID[input.category]}`)
  promptLines.push(`Kategori dalam bahasa Arab: ${FIGURE_CATEGORY_LABEL_AR[input.category]}`)
  promptLines.push('')
  if (input.gender) {
    promptLines.push(
      `GENDER_LOCK: hanya tokoh ${input.gender === 'male' ? 'LAKI-LAKI' : 'PEREMPUAN'}.`,
    )
  } else {
    promptLines.push('GENDER_LOCK: bebas.')
  }
  if (input.hints) promptLines.push(`HINTS dari admin: ${input.hints}`)
  promptLines.push('')
  promptLines.push(`Target jumlah kandidat: hingga ${limit} nama baru.`)
  promptLines.push('')
  if (existing.length > 0) {
    promptLines.push(`EXCLUDE_LIST (${existing.length} sudah ada di database):`)
    const sample = existing.slice(0, 200)
    for (const e of sample) {
      promptLines.push(`- ${e.nameFullId} | ${e.nameFullAr}`)
    }
    if (existing.length > sample.length) {
      promptLines.push(`- … (+${existing.length - sample.length} lagi)`)
    }
  } else {
    promptLines.push('EXCLUDE_LIST: kosong.')
  }
  promptLines.push('')
  promptLines.push('SOURCES:')
  if (sources.length === 0) {
    promptLines.push('(tidak ada source berhasil di-fetch — andalkan pengetahuan umum, tetap manhaj salaf, jangan mengarang.)')
  } else {
    for (const s of sources) {
      promptLines.push('---')
      promptLines.push(`URL: ${s.url}`)
      promptLines.push('CONTENT:')
      promptLines.push(s.content.slice(0, MAX_DISCOVER_CHARS_PER_PAGE))
    }
    promptLines.push('---')
  }
  promptLines.push('')
  promptLines.push('Hasilkan daftar kandidat sesuai schema.')

  // Scale `maxTokens` with the requested limit so a `limit=100` ask doesn't
  // truncate mid-array. Each candidate ~120 tokens (nameAr+nameId+optional
  // kunyah/laqab/shortHint + JSON scaffolding) plus 800 for the wrapper.
  const dynamicMaxTokens = Math.min(16_000, Math.max(4_000, 800 + limit * 150))
  let llmResult
  try {
    llmResult = await generateObject({
      model,
      schema: discoverFigureResponseSchema,
      system: DISCOVERY_SYSTEM_PROMPT,
      prompt: promptLines.join('\n'),
      temperature: 0.3,
      maxTokens: dynamicMaxTokens,
      mode: 'json',
      maxRetries: 2,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err: message }, 'generateObject failed during discovery')
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
    throw new Error(`Discovery gagal: ${message}`)
  }

  const rawCandidates = (llmResult.object.candidates ?? []).slice(0, limit)
  const withinBatch = dedupeWithinBatch(rawCandidates)
  const deduped = dedupeAgainstExisting(withinBatch, existing)

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
      contextSummary: `figure-discover ${input.category}${input.gender ? `/${input.gender}` : ''} → ${deduped.length} new`,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })
  } catch {
    /* swallow logging failures */
  }

  return {
    candidates: deduped,
    existingCount: existing.length,
    suggestedNew: deduped.length,
    sourcesFetched: sources.length,
    modelUsed: active.model.modelId,
    durationMs: Date.now() - startedAt,
  }
}

// ── Discover battles ────────────────────────────────────────────────────
//
// Lightweight: no LLM call — we rely on the chat model itself to enumerate
// names if no whitelist sources are configured. But for symmetry with
// figure discovery we expose an `agent`-backed generator that pulls a few
// whitelist pages, asks the model for candidates, and marks existing ones.

const discoverBattleCandidateSchema = z.object({
  nameId: z.string().min(2).max(160),
  nameAr: z.string().min(2).max(160),
  type: z.enum(['ghazwah', 'sariyyah', 'futuhat']),
  dateHintAh: z.string().max(60).optional(),
  shortHint: z.string().max(200).optional(),
})

const discoverBattleResponseSchema = z.object({
  candidates: z.array(discoverBattleCandidateSchema).max(MAX_DISCOVER_CANDIDATES),
})

const BATTLE_DISCOVER_SYSTEM_PROMPT = `Kamu adalah asisten riset Sirah Peperangan (ghazwah, sariyyah, futuhat).

Tugas: enumerasi nama-nama peristiwa peperangan sesuai filter yang
diberikan admin (type & era). Prinsip:

1. Manhaj salaf — sumber primer (Sirah Ibn Hisham, Tarikh ath-Thabari,
   al-Bidayah wan-Nihayah, dll) + ringkasan ulama salafi modern.
2. JANGAN mengarang — jika ragu, masukkan dengan shortHint "kemungkinan
   ada — verifikasi".
3. Hormati EXCLUDE_LIST.
4. nameAr = tulisan Arab asli; nameId = transliterasi Indonesia.
5. type wajib: ghazwah (Nabi ikut), sariyyah (Nabi tidak ikut), atau futuhat
   (penaklukan pasca-Nabi).
6. dateHintAh opsional — perkiraan tahun Hijriyah, mis. "2 H" atau "9 H".

OUTPUT: JSON sesuai schema. Hanya JSON.`

export interface BattleDiscoveryInput {
  type?: BattleType
  era?: string
  hints?: string
  limit?: number
}

export interface BattleDiscoveryCandidate {
  nameId: string
  nameAr: string
  type: BattleType
  dateHintAh?: string
  shortHint?: string
}

export interface BattleDiscoveryResult {
  candidates: BattleDiscoveryCandidate[]
  existingCount: number
  suggestedNew: number
  sourcesFetched: number
  modelUsed: string
  durationMs: number
}

interface ExistingBattle {
  nameAr: string
  nameId: string
}

function dedupeBattlesAgainstExisting(
  candidates: BattleDiscoveryCandidate[],
  existing: ExistingBattle[],
): BattleDiscoveryCandidate[] {
  if (existing.length === 0) return candidates
  const existingIds = existing.map((e) => normaliseName(e.nameId))
  const existingArs = existing.map((e) => normaliseName(e.nameAr))
  const out: BattleDiscoveryCandidate[] = []
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

export async function discoverBattleCandidates(
  userId: string,
  input: BattleDiscoveryInput,
): Promise<BattleDiscoveryResult> {
  const log = logger.child({ service: 'figure-ingest.discoverBattleCandidates', userId })
  const startedAt = Date.now()
  const limit = Math.min(
    Math.max(input.limit ?? DEFAULT_DISCOVER_LIMIT, 1),
    MAX_DISCOVER_CANDIDATES,
  )

  const active = await getActiveModel('agent')
  const model = getModelInstance(active)

  // Existing battles for dedupe — filter by type if requested.
  const existingConds = [isNull(battles.deletedAt)]
  if (input.type) existingConds.push(eq(battles.type, input.type))
  const existing = await db
    .select({ nameAr: battles.nameAr, nameId: battles.nameId })
    .from(battles)
    .where(and(...existingConds))

  // Build query string.
  const typeLabel = input.type
    ? input.type === 'ghazwah'
      ? 'ghazwah'
      : input.type === 'sariyyah'
        ? 'sariyyah'
        : 'futuhat'
    : 'peperangan dan futuhat Islam'
  const eraBit = input.era ? ` masa ${input.era}` : ''
  const hintBit = input.hints ? ` ${input.hints}` : ''
  const query = `daftar lengkap ${typeLabel}${eraBit}${hintBit}`.trim()

  const domains = await db
    .select({
      domain: whitelistDomains.domain,
      priority: whitelistDomains.priority,
    })
    .from(whitelistDomains)
    .where(and(eq(whitelistDomains.isActive, true), isNull(whitelistDomains.deletedAt)))

  const sources: { url: string; content: string }[] = []
  if (domains.length > 0) {
    const urls = await searchWhitelist(query, domains)
    for (const url of urls) {
      if (sources.length >= MAX_DISCOVER_PAGES) break
      try {
        const res = await fetchPage(url, { timeoutMs: 10_000, maxAttempts: 1 })
        const text = stripHtml(res.html)
        if (text.length < 200) continue
        sources.push({ url: res.finalUrl, content: text })
      } catch (err) {
        if (err instanceof RateLimitExceededError) continue
        log.debug({ url, err: (err as Error).message }, 'fetch failed; skip')
      }
    }
  }

  const promptLines: string[] = []
  promptLines.push(`Type filter: ${input.type ?? 'bebas (ghazwah/sariyyah/futuhat)'}`)
  if (input.era) promptLines.push(`Era filter: ${input.era}`)
  if (input.hints) promptLines.push(`HINTS dari admin: ${input.hints}`)
  promptLines.push(`Target jumlah kandidat: hingga ${limit}.`)
  promptLines.push('')
  if (existing.length > 0) {
    promptLines.push(`EXCLUDE_LIST (${existing.length} sudah ada):`)
    const sample = existing.slice(0, 200)
    for (const e of sample) {
      promptLines.push(`- ${e.nameId} | ${e.nameAr}`)
    }
    if (existing.length > sample.length) {
      promptLines.push(`- … (+${existing.length - sample.length} lagi)`)
    }
  } else {
    promptLines.push('EXCLUDE_LIST: kosong.')
  }
  promptLines.push('')
  promptLines.push('SOURCES:')
  if (sources.length === 0) {
    promptLines.push('(tidak ada source berhasil di-fetch — andalkan pengetahuan umum, manhaj salaf, jangan mengarang.)')
  } else {
    for (const s of sources) {
      promptLines.push('---')
      promptLines.push(`URL: ${s.url}`)
      promptLines.push('CONTENT:')
      promptLines.push(s.content.slice(0, MAX_DISCOVER_CHARS_PER_PAGE))
    }
    promptLines.push('---')
  }
  promptLines.push('')
  promptLines.push('Hasilkan daftar kandidat sesuai schema.')

  // Same dynamic sizing as figure discovery — battles have a longer
  // `shortHint` field (because admin needs context like "perang di Khaybar
  // 7H") so we bump the per-candidate budget slightly.
  const dynamicMaxTokens = Math.min(16_000, Math.max(4_000, 800 + limit * 180))
  let llmResult
  try {
    llmResult = await generateObject({
      model,
      schema: discoverBattleResponseSchema,
      system: BATTLE_DISCOVER_SYSTEM_PROMPT,
      prompt: promptLines.join('\n'),
      temperature: 0.3,
      maxTokens: dynamicMaxTokens,
      mode: 'json',
      maxRetries: 2,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error({ err: message }, 'generateObject failed during battle discovery')
    throw new Error(`Discovery gagal: ${message}`)
  }

  const rawCandidates = (llmResult.object.candidates ?? []).slice(0, limit)
  // If a type filter is provided, drop candidates whose type doesn't match.
  const filtered = input.type
    ? rawCandidates.filter((c) => c.type === input.type)
    : rawCandidates
  const deduped = dedupeBattlesAgainstExisting(filtered, existing)

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
      contextSummary: `battle-discover ${input.type ?? 'any'}${input.era ? `/${input.era}` : ''} → ${deduped.length} new`,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })
  } catch {
    /* swallow */
  }

  return {
    candidates: deduped,
    existingCount: existing.length,
    suggestedNew: deduped.length,
    sourcesFetched: sources.length,
    modelUsed: active.model.modelId,
    durationMs: Date.now() - startedAt,
  }
}
