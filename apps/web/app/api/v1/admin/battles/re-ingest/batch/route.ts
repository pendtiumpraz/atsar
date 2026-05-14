// POST /api/v1/admin/battles/re-ingest/batch
//
// Bulk variant of `POST /api/v1/admin/battles/[slug]/re-ingest`. Admin
// supplies up to 50 battle slugs plus a shared mode + focusFields + hints;
// we INSERT one `research_jobs` row per slug in a single `db.batch`, then
// publish a QStash message per row (best-effort).
//
// Response: 202 with { created, queued, failures }.
// Permission: `battles.update`.
// Mirrors apps/web/app/api/v1/admin/figures/re-ingest/batch/route.ts.

import { z } from 'zod'
import { and, eq, gte, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { battles, researchJobs } from '@athar/db/schema'
import { ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

const RE_INGEST_FIELDS = [
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
  'narrativeId',
  'significanceId',
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
  const { userId } = await requirePermission(req, 'battles.update')
  const input = await validateBody(req, batchSchema)
  const log = logger.child({ route: '/api/v1/admin/battles/re-ingest/batch', userId })

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

  // ── 2. Resolve all battles in one round-trip. Trashed battles cannot be
  //       refreshed; we surface them as failures.
  const battleRows = await db
    .select({
      id: battles.id,
      slug: battles.slug,
      type: battles.type,
      nameAr: battles.nameAr,
      nameId: battles.nameId,
      eventDateAh: battles.eventDateAh,
      eventDateCe: battles.eventDateCe,
      eventDatePrecision: battles.eventDatePrecision,
      eventDateNotes: battles.eventDateNotes,
      opponentForce: battles.opponentForce,
      muslimCount: battles.muslimCount,
      opponentCount: battles.opponentCount,
      outcome: battles.outcome,
      casualtiesMuslim: battles.casualtiesMuslim,
      casualtiesOpponent: battles.casualtiesOpponent,
      strategyId: battles.strategyId,
      narrativeId: battles.narrativeId,
      significanceId: battles.significanceId,
    })
    .from(battles)
    .where(and(inArray(battles.slug, uniqueSlugs), isNull(battles.deletedAt)))

  const bySlug = new Map(battleRows.map((row) => [row.slug, row]))
  const resolved: typeof battleRows = []
  for (const slug of uniqueSlugs) {
    const row = bySlug.get(slug)
    if (!row) {
      failures.push({ slug, reason: 'sirah perang tidak ditemukan atau berada di trash' })
      continue
    }
    resolved.push(row)
  }

  if (resolved.length === 0) {
    return ok({ created: 0, queued: 0, failures }, undefined, { status: 202 })
  }

  // ── 3. De-dup against recent (last hour) re-ingest jobs for the same
  //       battleId so a re-paste of the list doesn't double-spend AI credits.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentRows = await db
    .select({ payload: researchJobs.payload })
    .from(researchJobs)
    .where(
      and(
        eq(researchJobs.type, 'battle_reingest'),
        gte(researchJobs.createdAt, hourAgo),
        sql`${researchJobs.status} IN ('pending', 'running')`,
      ),
    )

  const recentBattleIds = new Set<string>()
  for (const row of recentRows) {
    const p = row.payload as { battleId?: string } | null
    if (p?.battleId) recentBattleIds.add(p.battleId)
  }

  const toInsert = resolved.filter((row) => {
    if (recentBattleIds.has(row.id)) {
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
      nameAr: row.nameAr,
      nameId: row.nameId,
      type: row.type,
      eventDateAh: row.eventDateAh,
      eventDateCe: row.eventDateCe,
      eventDatePrecision: row.eventDatePrecision,
      eventDateNotes: row.eventDateNotes,
      opponentForce: row.opponentForce,
      muslimCount: row.muslimCount,
      opponentCount: row.opponentCount,
      outcome: row.outcome,
      casualtiesMuslim: row.casualtiesMuslim,
      casualtiesOpponent: row.casualtiesOpponent,
      strategyId: row.strategyId,
      narrativeId: row.narrativeId,
      significanceId: row.significanceId,
    }
    const payload = {
      battleId: row.id,
      slug: row.slug,
      name: row.nameAr || row.nameId,
      type: row.type,
      mode: input.mode,
      focusFields: input.focusFields ?? [],
      hints: input.hints,
      originalSnapshot,
    }
    return db
      .insert(researchJobs)
      .values({
        type: 'battle_reingest',
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
    .map((r, i) => ({ jobId: r[0]?.id ?? null, battle: toInsert[i]! }))
    .filter((r) => r.jobId !== null) as Array<{
    jobId: string
    battle: (typeof toInsert)[number]
  }>

  // ── 5. Publish QStash messages — settle-all so one failure doesn't
  //       abort the rest. Rows stay `pending` if publish fails.
  const publishResults = await Promise.allSettled(
    created.map(({ jobId, battle }) =>
      publishJob(
        'research',
        { type: 'battle_reingest', jobId },
        { deduplicationId: `battle-reingest-${battle.id}-${jobId}` },
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
        slug: row.battle.slug,
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
