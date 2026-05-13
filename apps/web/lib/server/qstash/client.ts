// QStash client + publishing helpers.
// See docs/ARCHITECTURE.md §4 — Worker Strategy (QStash, not BullMQ).
//
// All async work in Atsar runs via QStash HTTP webhooks back to
// `/api/jobs/*` route handlers. This module wraps the Upstash SDK with
// project-aware helpers so callers don't need to remember the base URL or
// signing options.

import { Client } from '@upstash/qstash'

/**
 * Resolve the absolute base URL the worker is reachable at. QStash needs a
 * fully qualified `https://…` URL; relative paths won't deliver.
 *
 * Order of precedence:
 *   1. `NEXT_PUBLIC_APP_URL` — canonical, set in Vercel for prod/preview.
 *   2. `VERCEL_URL` — auto-injected on Vercel; lacks scheme, prepend https://.
 *   3. `http://localhost:3000` — local dev fallback.
 */
function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit && explicit.length > 0) {
    return explicit.replace(/\/$/, '')
  }
  const vercel = process.env.VERCEL_URL
  if (vercel && vercel.length > 0) {
    return `https://${vercel.replace(/\/$/, '')}`
  }
  return 'http://localhost:3000'
}

/**
 * Shared QStash client. Reads `QSTASH_TOKEN` (required in prod). The token
 * may legitimately be missing in CI/local — calls will fail at request time
 * rather than at module load, which is the desired behaviour for a
 * lazily-used worker queue.
 */
export const qstash = new Client({
  token: process.env.QSTASH_TOKEN ?? '',
})

/** Options accepted by `publishJob`. */
export interface PublishJobOptions {
  /** Delay delivery by N seconds (QStash `delay`). */
  delaySec?: number
  /** Max retries on non-2xx response (QStash default 3). */
  retries?: number
  /**
   * Deduplication key — QStash drops duplicate publishes with the same id
   * within its retention window. Use to make `publishJob` idempotent from
   * the producer side (e.g. `figure-research-<figureId>`).
   */
  deduplicationId?: string
  /** Optional content-based dedup (QStash hashes body+url). */
  contentBasedDeduplication?: boolean
  /**
   * Override the destination URL. Defaults to `${APP_URL}/api/jobs/${name}`.
   * Useful for test harnesses.
   */
  url?: string
  /** Forwarded headers (rarely needed). */
  headers?: Record<string, string>
}

/**
 * Publish a job to `/api/jobs/<name>`. Returns the QStash message id.
 *
 * The destination URL is computed from `NEXT_PUBLIC_APP_URL` so the same
 * code path works on Vercel preview, prod, and local (with a tunnel).
 *
 * Job handlers MUST verify the QStash signature (`verifySignatureAppRouter`).
 */
export async function publishJob(
  name: string,
  body: object,
  opts: PublishJobOptions = {},
): Promise<{ messageId: string }> {
  const url = opts.url ?? `${resolveAppUrl()}/api/jobs/${name}`

  const res = await qstash.publishJSON({
    url,
    body,
    delay: opts.delaySec,
    retries: opts.retries,
    deduplicationId: opts.deduplicationId,
    contentBasedDeduplication: opts.contentBasedDeduplication,
    headers: opts.headers,
  })

  // The SDK shape is `{ messageId }` for non-FIFO publishes.
  const messageId =
    typeof res === 'object' && res !== null && 'messageId' in res
      ? String((res as { messageId: unknown }).messageId)
      : ''
  return { messageId }
}

/**
 * Idempotently create a QStash schedule for `cron` -> `/api/jobs/<name>`.
 *
 * QStash schedules are keyed by `(destination, cron)` server-side but the
 * REST API doesn't dedupe — calling create twice produces two schedules.
 * We list existing schedules and skip when a matching destination already
 * exists, so re-running this at deploy time is safe.
 *
 * @returns The schedule id (existing or newly created).
 */
export async function scheduleJob(
  cron: string,
  name: string,
  body: object = {},
): Promise<{ scheduleId: string; created: boolean }> {
  const destination = `${resolveAppUrl()}/api/jobs/${name}`
  const schedules = qstash.schedules

  // Look up an existing schedule pointing at our destination URL + cron.
  // The SDK returns `Schedule[]` from `.list()`. We compare destination and
  // cron together so re-deploying with a different cron triggers a new
  // schedule (the old one can be cleaned up manually if desired).
  const existing = await schedules.list()
  const match = existing.find(
    (s) => s.destination === destination && s.cron === cron,
  )
  if (match) {
    return { scheduleId: match.scheduleId, created: false }
  }

  const created = await schedules.create({
    destination,
    cron,
    body: JSON.stringify(body),
  })

  return { scheduleId: created.scheduleId, created: true }
}

/** Resolve the public app URL (exported for callers that need it). */
export function appUrl(): string {
  return resolveAppUrl()
}
