// Idempotency middleware backed by Upstash Redis.
//
// Wraps a unit of work so that retries carrying the same `Idempotency-Key`
// header observe at-most-once semantics within the configured TTL:
//
//   * First request → marks the key `pending`, runs `exec`, caches the
//     result as `done`.
//   * Concurrent retry while still `pending` → 409 CONFLICT (caller should
//     retry after a short delay).
//   * Later retry once `done` → cached result is replayed verbatim.
//   * If `exec` throws, we delete the pending marker so a retry can run.
//
// Requests without an `Idempotency-Key` header bypass caching entirely.

import { redis } from '@/lib/server/upstash'
import { ApiError } from '@/lib/server/api'

type PendingEntry = { status: 'pending' }
type DoneEntry<T> = { status: 'done'; data: T }
type IdempotencyEntry<T> = PendingEntry | DoneEntry<T>

/**
 * Read the `Idempotency-Key` header, treating empty / whitespace-only values
 * as absent. Returns the trimmed key or `null`.
 */
function readKey(req: Request): string | null {
  const raw = req.headers.get('idempotency-key')
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Run `exec`, but if the request carries an `Idempotency-Key` header, cache
 * its result in Redis under `idem:${scope}:${key}` for `ttlSec` seconds so
 * future retries with the same key replay the cached result.
 *
 * - `scope` namespaces keys per operation (e.g. `'pdf-export'`,
 *   `'create-payment'`) so the same client key can be reused across
 *   different endpoints without colliding.
 * - `ttlSec` applies to both the `pending` marker and the cached `done`
 *   entry. Pick a value larger than your worst-case `exec` duration.
 *
 * Throws `ApiError('CONFLICT')` if a concurrent request with the same key
 * is still in flight.
 */
export async function withIdempotency<T>(
  req: Request,
  scope: string,
  ttlSec: number,
  exec: () => Promise<T>,
): Promise<T> {
  const idemKey = readKey(req)
  if (!idemKey) {
    // No header → no caching; just run.
    return exec()
  }

  const storageKey = `idem:${scope}:${idemKey}`
  const pending: PendingEntry = { status: 'pending' }

  // Try to claim the slot atomically.
  const claimed = await redis.set(storageKey, pending, {
    ex: ttlSec,
    nx: true,
  })

  if (claimed !== 'OK') {
    // Someone else has the slot — either still running or completed.
    const existing = await redis.get<IdempotencyEntry<T>>(storageKey)
    if (!existing) {
      // Race: entry expired between SET NX and GET. Safest behavior is to
      // retry the claim once; if that also fails, surface CONFLICT.
      const retry = await redis.set(storageKey, pending, {
        ex: ttlSec,
        nx: true,
      })
      if (retry !== 'OK') {
        throw new ApiError('CONFLICT', 'Request already in progress')
      }
      return runAndCache(storageKey, ttlSec, exec)
    }
    if (existing.status === 'pending') {
      throw new ApiError('CONFLICT', 'Request already in progress')
    }
    // status === 'done' → replay the cached result.
    return existing.data
  }

  return runAndCache(storageKey, ttlSec, exec)
}

/**
 * Internal helper: run `exec` while holding a claimed idempotency slot.
 * On success, persist the result; on failure, drop the pending marker so
 * the caller can retry without waiting for it to expire.
 */
async function runAndCache<T>(
  storageKey: string,
  ttlSec: number,
  exec: () => Promise<T>,
): Promise<T> {
  try {
    const result = await exec()
    const done: DoneEntry<T> = { status: 'done', data: result }
    await redis.set(storageKey, done, { ex: ttlSec })
    return result
  } catch (err) {
    // Release the pending marker so a retry isn't blocked until TTL expires.
    // Best-effort: ignore Redis errors here so we surface the original cause.
    try {
      await redis.del(storageKey)
    } catch {
      // swallow — we'd rather surface the original error
    }
    throw err
  }
}
