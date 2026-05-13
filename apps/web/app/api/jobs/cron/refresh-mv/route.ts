// Cron: refresh the `ai_usage_monthly_summary` materialized view.
// Scheduled via QStash (hourly, `0 * * * *`) — see docs/ARCHITECTURE.md §4
// and docs/DATABASE.md §8.6 for the underlying view definition.
//
// Why `REFRESH ... CONCURRENTLY`: a non-concurrent refresh takes an
// `ACCESS EXCLUSIVE` lock on the view, blocking every reader for the
// duration of the rebuild. CONCURRENTLY rebuilds into a new heap and swaps
// atomically, but it *requires* a UNIQUE index on the view. We create that
// index in `packages/db/src/post-migrate.ts` (`ai_usage_monthly_summary_pk`).
//
// Connection choice: we use the `postgres` driver against
// `DATABASE_URL_UNPOOLED` (direct connection, not PgBouncer) because:
//   - PgBouncer transaction-pooling mode does not support session-level
//     locks that `REFRESH MATERIALIZED VIEW CONCURRENTLY` may need.
//   - This is a slow maintenance op (potentially many seconds) — running
//     it against the pooler would tie up a shared transaction slot.
//
// Idempotency: refreshing twice in a row is a no-op (the data is the same).

import postgres from 'postgres'

import { withSignature } from '../../_lib/with-signature'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export const POST = withSignature(async (_req) => {
  const url = process.env['DATABASE_URL_UNPOOLED']
  if (!url) {
    return Response.json(
      { ok: false, error: 'DATABASE_URL_UNPOOLED not configured' },
      { status: 500 },
    )
  }

  // Single-shot connection: open, refresh, close. We never pool here
  // because the route only runs hourly and the connection cost is trivial
  // compared to the refresh itself.
  const sql = postgres(url, { max: 1, prepare: false })

  try {
    await sql.unsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY ai_usage_monthly_summary',
    )
    const refreshedAt = new Date().toISOString()
    return Response.json({ ok: true, refreshedAt })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/refresh-mv] refresh failed', { err: message })
    return Response.json({ ok: false, error: message }, { status: 500 })
  } finally {
    await sql.end({ timeout: 5 })
  }
})
