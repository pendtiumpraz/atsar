// POST /api/v1/admin/battles/:slug/re-ingest
//
// "Perbarui Perang via AI" flow: re-runs the Deep Research pipeline for an
// existing battle row so admins can fill empty fields (`enrich` mode) or
// regenerate the narrative from scratch (`replace` mode) without manually
// editing each one. Mirrors `POST /api/v1/admin/figures/[slug]/re-ingest`.
//
// Body shape:
//   {
//     mode?: 'enrich' | 'replace',     // default 'enrich'
//     focusFields?: string[],          // columns the AI should focus on
//     hints?: string,                  // admin steering
//   }
//
// Response: 202 with { jobId, status: 'pending' }.
// Permission: `battles.update`.

import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { battlePhases, battles, researchJobs } from '@athar/db/schema'
import { ApiError, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

// Re-ingest writeable surface — admins can ask the AI to refresh any of these.
// The worker still ground-truths against the BattleExtraction schema so unknown
// keys are ignored downstream.
//
// `participants` and `phases` are VIRTUAL focus fields: they do not name a
// column on `battles`. The worker's `handleBattleReIngest` branches on these
// to drive the `battle_participants` / `battle_phases` sub-pipelines (Phase
// 7.5.6 — Tokoh peserta + Fase pertempuran).
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
  'strategyAr',
  'narrativeId',
  'narrativeAr',
  'significanceId',
  'significanceAr',
  // Single-FK relationships (resolved server-side by name → id lookup).
  'commanderId',
  'locationId',
  'citations',
  // Virtual focus fields driving battle_participants / battle_phases
  // sub-pipelines.
  'participants',
  'phases',
] as const

const paramsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[a-z0-9-]+$/, {
      message: 'Slug tidak valid (gunakan huruf kecil, angka, dan tanda hubung).',
    }),
})

export const reIngestRequestSchema = z.object({
  mode: z.enum(['enrich', 'replace']).default('enrich'),
  focusFields: z.array(z.enum(RE_INGEST_FIELDS)).max(RE_INGEST_FIELDS.length).optional(),
  hints: z.string().trim().max(2000).optional(),
})

interface RouteCtx {
  params: Promise<{ slug: string }>
}

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'battles.update')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, reIngestRequestSchema)
  const log = logger.child({
    route: '/api/v1/admin/battles/[slug]/re-ingest',
    userId,
    slug,
  })

  // 1. Resolve the battle (active rows only — trashed battles cannot be
  //    refreshed; restore them first).
  const battle = await db.query.battles.findFirst({
    where: and(eq(battles.slug, slug), isNull(battles.deletedAt)),
  })
  if (!battle) {
    throw new ApiError('NOT_FOUND', `Sirah perang tidak ditemukan: ${slug}`)
  }

  // 2. Capture the original snapshot so the diff is replayable.
  //    Phase 7.5.6: also snapshot the current `battle_phases` rows so a
  //    future "Tolak" on the Fase row can restore them (the worker
  //    soft-deletes the originals in replace mode).
  const existingPhases = await db
    .select()
    .from(battlePhases)
    .where(and(eq(battlePhases.battleId, battle.id), isNull(battlePhases.deletedAt)))
    .orderBy(asc(battlePhases.phaseOrder))

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
    // Compact phase snapshot — column names mirror the table.
    phases: existingPhases.map((p) => ({
      id: p.id,
      phaseOrder: p.phaseOrder,
      titleAr: p.titleAr,
      titleId: p.titleId,
      descriptionAr: p.descriptionAr,
      descriptionId: p.descriptionId,
      phaseLocationId: p.phaseLocationId,
      arrowFromId: p.arrowFromId,
      arrowToId: p.arrowToId,
      durationHours: p.durationHours,
    })),
  }

  // 3. Insert the job row first — audit-first discipline so a QStash publish
  //    failure still leaves a trace.
  const payload = {
    battleId: battle.id,
    slug: battle.slug,
    name: battle.nameAr || battle.nameId,
    type: battle.type,
    mode: input.mode,
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
    log.error('insert research_jobs returned no row')
    throw new ApiError('INTERNAL_ERROR', 'Gagal membuat job re-ingest.')
  }

  // 4. Fire the QStash webhook → `/api/jobs/research` (battle_reingest case).
  let messageId: string | null = null
  let publishError: string | null = null
  try {
    const res = await publishJob(
      'research',
      { type: 'battle_reingest', jobId: job.id },
      {
        deduplicationId: `battle-reingest-${battle.id}-${job.id}`,
      },
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
      'QStash publish failed — falling back to inline self-fetch',
    )
    // QStash unavailable — fire-and-forget self-fetch with internal token.
    // ONLY accept the dedicated job-token (no session-secret fallback) —
    // mirrors the producer-side hardening in with-signature.ts.
    const origin = new URL(req.url).origin
    const secret = process.env['INTERNAL_JOB_TOKEN']
    if (secret) {
      void fetch(`${origin}/api/jobs/research`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': secret,
        },
        body: JSON.stringify({ type: 'battle_reingest', jobId: job.id }),
      }).catch((fetchErr) => {
        log.error(
          { jobId: job.id, err: String(fetchErr) },
          'Inline self-fetch fallback also failed',
        )
      })
    }
  }

  return ok(
    {
      jobId: job.id,
      status: 'pending' as const,
      battleId: battle.id,
      mode: input.mode,
      messageId,
      ...(publishError ? { publishError } : {}),
    },
    undefined,
    { status: 202 },
  )
})
