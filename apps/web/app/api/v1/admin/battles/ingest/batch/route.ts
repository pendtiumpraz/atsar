// POST /api/v1/admin/battles/ingest/batch
//
// Bulk variant of the single ingest endpoint. Admin pastes a list of battle
// names (max 100) with a shared `type` (optional) + optional shared `hints`;
// we INSERT one `research_jobs` row per name in a single `db.batch`, then
// publish a QStash message per row (best-effort).
//
// Response: 202 with { created, queued, failures }.
//   - created  = number of rows actually inserted (after dedupe within
//                batch and against any existing pending/running job with
//                the same name in the last hour).
//   - queued   = how many QStash messages we managed to publish.
//   - failures = [{ name, reason }] for items skipped or publishes that
//                failed; the rows are still in the DB for the admin to
//                retry from UI.
//
// Permission: `battles.create`.
// Mirrors apps/web/app/api/v1/admin/figures/ingest/batch/route.ts.

import { z } from 'zod'
import { and, eq, gte, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { researchJobs } from '@athar/db/schema'
import { ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

const BATTLE_TYPES = ['ghazwah', 'sariyyah', 'futuhat'] as const

const itemSchema = z.object({
  name: z.string().trim().min(2).max(160),
  type: z.enum(BATTLE_TYPES).optional(),
  hints: z.string().trim().max(2000).optional(),
})

const batchSchema = z.object({
  items: z.array(itemSchema).min(1).max(100),
})

interface Failure {
  name: string
  reason: string
}

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'battles.create')
  const input = await validateBody(req, batchSchema)
  const log = logger.child({ route: '/api/v1/admin/battles/ingest/batch', userId })

  // ── 1. Normalise + de-dup within the batch (case-insensitive trim). ──
  const seen = new Set<string>()
  const failures: Failure[] = []
  const candidates: z.infer<typeof itemSchema>[] = []
  for (const raw of input.items) {
    const key = raw.name.toLowerCase()
    if (seen.has(key)) {
      failures.push({ name: raw.name, reason: 'duplikat dalam batch' })
      continue
    }
    seen.add(key)
    candidates.push(raw)
  }

  // ── 2. De-dup against recent (last hour) pending/running ingests so
  //       a re-paste of the same list doesn't double-spend AI credits. ──
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
    return ok(
      { created: 0, queued: 0, failures, agentConfigured: true },
      undefined,
      { status: 202 },
    )
  }

  // ── 3. Insert all rows in a single batch (Neon HTTP: db.batch, not txn). ──
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
    item: z.infer<typeof itemSchema>
  }>

  // ── 4. Publish QStash messages — settle-all so one publish fail doesn't
  //       abort the rest. The row stays in `pending` if publish fails so
  //       the admin can retry from the UI.
  const publishResults = await Promise.allSettled(
    created.map(({ jobId }) =>
      publishJob(
        'research',
        { type: 'battle_ingest', jobId },
        { deduplicationId: `battle-ingest-${jobId}` },
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
    'batch ingest complete',
  )

  return ok(
    {
      created: created.length,
      queued,
      failures,
      agentConfigured: true,
    },
    undefined,
    { status: 202 },
  )
})
