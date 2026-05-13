// Cron: hard-delete soft-deleted rows older than 30 days from user-visible
// tables (figures, battles, locations). Scheduled via QStash (daily 03:00 UTC).
//
// Idempotency: a row that has already been hard-deleted simply won't appear
// in the next scan, so re-running is safe. Each deletion is wrapped in an
// audit log entry for compliance.
//
// Retention policy: 30 days from `deletedAt`. Configurable per-table if a
// future product decision requires it.

import { withSignature } from '../../_lib/with-signature'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// TODO: wire to packages/db schemas once finalised.
// import { db } from '@athar/db'
// import { figures, battles, locations, auditLog } from '@athar/db/schema'
// import { and, isNotNull, lt } from 'drizzle-orm'

const RETENTION_DAYS = 30

/** Tables that participate in soft-delete -> hard-delete sweep. */
const TARGETS = ['figures', 'battles', 'locations'] as const
type TargetTable = (typeof TARGETS)[number]

interface PurgeResult {
  table: TargetTable
  deleted: number
  failed: number
}

async function purgeTable(table: TargetTable, _cutoff: Date): Promise<PurgeResult> {
  // TODO: replace stub with real Drizzle query + audit log insert.
  //
  // Example shape:
  //   const rows = await db
  //     .select({ id: <table>.id })
  //     .from(<table>)
  //     .where(and(isNotNull(<table>.deletedAt), lt(<table>.deletedAt, _cutoff)))
  //
  //   for (const r of rows) {
  //     await db.transaction(async (tx) => {
  //       await tx.delete(<table>).where(eq(<table>.id, r.id))
  //       await tx.insert(auditLog).values({
  //         actorId: null,
  //         action: 'hard_delete',
  //         entity: '<table>',
  //         entityId: r.id,
  //         meta: { reason: 'retention', cutoff: _cutoff.toISOString() },
  //       })
  //     })
  //   }
  return { table, deleted: 0, failed: 0 }
}

export const POST = withSignature(async (_req) => {
  const now = new Date()
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const results: PurgeResult[] = []
  for (const table of TARGETS) {
    try {
      results.push(await purgeTable(table, cutoff))
    } catch (err) {
      console.error('[cron/purge-trash] purgeTable failed', { table, err })
      results.push({ table, deleted: 0, failed: 1 })
    }
  }

  const totalDeleted = results.reduce((acc, r) => acc + r.deleted, 0)

  return Response.json({
    ok: true,
    processed: totalDeleted,
    cutoff: cutoff.toISOString(),
    at: now.toISOString(),
    results,
  })
})
