// One-time setup: register QStash schedules for the cron-style jobs.
//
// Usage (run once after each deploy that adds/changes a schedule):
//   pnpm --filter @athar/db exec tsx src/scripts/register-schedules.ts
//
// Why a script, not a route: schedules are created against the absolute
// production URL of the worker, so this must run *after* the app is
// deployed and `NEXT_PUBLIC_APP_URL` points at the live host. A route
// would re-register on every cold start, wasting QStash quota.
//
// Idempotency: we list existing schedules and skip when a (destination,
// cron) pair already exists. Safe to re-run.
//
// See docs/ARCHITECTURE.md §4 for the worker strategy.

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { Client } from '@upstash/qstash'

interface ScheduleSpec {
  /** Sub-path under `/api/jobs/` (matches the route folder name). */
  job: string
  /** Cron expression in UTC. */
  cron: string
  /** Human-readable description for log output. */
  description: string
}

const SCHEDULES: ScheduleSpec[] = [
  {
    job: 'cron/reset-quotas',
    cron: '1 0 * * *',
    description: 'Reset monthly quotas (daily 00:01 UTC)',
  },
  {
    job: 'cron/purge-trash',
    cron: '0 3 * * *',
    description: 'Hard-delete soft-deleted rows (daily 03:00 UTC)',
  },
  {
    job: 'cron/refresh-mv',
    cron: '0 * * * *',
    description: 'Refresh ai_usage_monthly_summary materialized view (hourly)',
  },
]

async function main() {
  const token = process.env['QSTASH_TOKEN']
  if (!token) {
    throw new Error('QSTASH_TOKEN not set — cannot register schedules.')
  }

  const appUrl = process.env['NEXT_PUBLIC_APP_URL']
  if (!appUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL not set — schedules must point at an absolute ' +
        'https URL. Set it to your deployed worker host before running.',
    )
  }

  const baseUrl = appUrl.replace(/\/$/, '')
  const qstash = new Client({ token })

  // Fetch existing schedules once; the SDK has no server-side dedup so we
  // build our own lookup by (destination, cron). Re-running the script
  // therefore skips already-registered jobs instead of duplicating them.
  const existing = await qstash.schedules.list()
  const seen = new Set(existing.map((s) => `${s.destination}|${s.cron}`))

  console.log(`Registering ${SCHEDULES.length} schedules against ${baseUrl}`)
  console.log(`(${existing.length} schedule(s) currently in QStash)\n`)

  let created = 0
  let skipped = 0
  for (const spec of SCHEDULES) {
    const destination = `${baseUrl}/api/jobs/${spec.job}`
    const key = `${destination}|${spec.cron}`

    if (seen.has(key)) {
      console.log(`  - skip   ${spec.job}  (${spec.cron})  already exists`)
      skipped += 1
      continue
    }

    try {
      const res = await qstash.schedules.create({
        destination,
        cron: spec.cron,
        body: JSON.stringify({}),
      })
      console.log(
        `  ✓ create ${spec.job}  (${spec.cron})  id=${res.scheduleId}`,
      )
      console.log(`           ${spec.description}`)
      created += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ FAIL   ${spec.job}  ${msg}`)
      throw err
    }
  }

  console.log(`\nDone. created=${created} skipped=${skipped}`)
}

main().catch((err) => {
  console.error('register-schedules failed:', err)
  process.exit(1)
})
