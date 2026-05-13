// Cron: reset monthly quotas for active subscriptions whose
// `quotaResetAt <= now()`. Scheduled via QStash (daily 00:01 UTC) — see
// docs/ARCHITECTURE.md §4.
//
// This handler is idempotent: calling `resetForUser` twice for the same
// user is a no-op (quota row is upserted, period start/end advanced).
//
// Vercel timeout: 60s (cron). If users-due grows past what we can process
// in 60s, switch to chunked fan-out (publish N child jobs of 100 users).

import { withSignature } from '../../_lib/with-signature'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// TODO: wire to packages/db once quota.service lands.
// import { quotaService } from '@athar/db/services/quota'
// import { db } from '@athar/db'
// import { subscriptions } from '@athar/db/schema'
// import { and, eq, lte } from 'drizzle-orm'

/**
 * Find all subscriptions whose quota window has elapsed, then reset each
 * one. Returns the count processed so we can audit/alert on anomalies.
 */
async function listDueSubscriptions(_now: Date): Promise<Array<{ userId: string }>> {
  // TODO: replace stub with real query once db schema is finalised.
  // return db
  //   .select({ userId: subscriptions.userId })
  //   .from(subscriptions)
  //   .where(
  //     and(
  //       eq(subscriptions.status, 'active'),
  //       lte(subscriptions.quotaResetAt, _now),
  //     ),
  //   )
  return []
}

async function resetForUser(_userId: string): Promise<void> {
  // TODO: call quotaService.resetForUser(userId) when service exists.
  // For now this is a no-op so the cron route can be wired and verified
  // end-to-end without a hard dependency.
}

export const POST = withSignature(async (_req) => {
  const now = new Date()
  const due = await listDueSubscriptions(now)

  let processed = 0
  let failed = 0
  for (const row of due) {
    try {
      await resetForUser(row.userId)
      processed += 1
    } catch (err) {
      failed += 1
      // Keep going — one bad row shouldn't break the whole batch. QStash
      // will not retry the whole job; per-user retries are handled by
      // resetForUser itself (DB-level idempotency).
      console.error('[cron/reset-quotas] resetForUser failed', {
        userId: row.userId,
        err,
      })
    }
  }

  return Response.json({
    ok: true,
    processed,
    failed,
    at: now.toISOString(),
  })
})
