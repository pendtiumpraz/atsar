// Lightweight fixed-window rate limiter on top of Upstash Redis.
//
// Implementation note: we use a fixed window keyed by `floor(now / window)`
// rather than a precise sliding window. This costs one INCR (+ optional
// EXPIRE on first hit) per request, which is fast and cheap. If precision
// matters for a specific endpoint, swap in `@upstash/ratelimit` there.
//
// All limiters throw `ApiError('RATE_LIMITED', ...)` on overflow with a
// `retryAfter` hint in `details` so route handlers / `withErrorHandling`
// can surface it to clients via the standard error envelope.

import { redis } from '@/lib/server/upstash'
import { ApiError } from '@/lib/server/api'

/** Options accepted by `consume`. */
export type RateLimitOptions = {
  /** Unique limiter id (namespace), e.g. `'ai-chat'`. */
  key: string
  /** Maximum number of requests allowed per window for a given identifier. */
  limit: number
  /** Sliding window length in seconds. */
  windowSec: number
}

/** Result returned by a successful `consume` call. */
export type RateLimitResult = {
  /** Slots remaining in the current window (>= 0). */
  remaining: number
  /** Epoch seconds at which the current window resets. */
  reset: number
}

/**
 * Check + consume one slot for `identifier` against the limiter described by
 * `options`. Throws `ApiError('RATE_LIMITED')` (HTTP 429) when the identifier
 * has exceeded its budget for the current window.
 *
 * Implementation: fixed-window via Redis INCR on a key bucketed by
 * `floor(now / windowSec)`. On the first hit in a bucket we set an EXPIRE
 * slightly larger than the window so the key auto-evicts; if EXPIRE fails
 * the key will still roll over with the next bucket transition.
 */
export async function consume(
  options: RateLimitOptions,
  identifier: string,
): Promise<RateLimitResult> {
  const { key, limit, windowSec } = options
  const nowSec = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(nowSec / windowSec)
  const reset = (bucket + 1) * windowSec
  const redisKey = `rl:${key}:${identifier}:${bucket}`

  const count = await redis.incr(redisKey)
  if (count === 1) {
    // First hit in this bucket — best-effort TTL slightly above the window.
    await redis.expire(redisKey, windowSec + 5)
  }

  if (count > limit) {
    const retryAfter = Math.max(1, reset - nowSec)
    throw new ApiError('RATE_LIMITED', 'Too many requests', {
      details: {
        limit,
        windowSec,
        retryAfter,
        reset,
      },
    })
  }

  return {
    remaining: Math.max(0, limit - count),
    reset,
  }
}

/**
 * Pre-configured limiters for common endpoints. Each accepts an identifier
 * (typically a userId or IP) and returns `{ remaining, reset }` or throws
 * `ApiError('RATE_LIMITED')`.
 *
 * Tweak the values here in one place rather than at every call site.
 */
export const limiters = {
  /** Auth login attempts: 5 / minute (per identifier). */
  authLogin: (id: string): Promise<RateLimitResult> =>
    consume({ key: 'auth-login', limit: 5, windowSec: 60 }, id),
  /** AI chat requests: 10 / minute. */
  aiChat: (id: string): Promise<RateLimitResult> =>
    consume({ key: 'ai-chat', limit: 10, windowSec: 60 }, id),
  /** PDF exports: 3 / minute. */
  pdfExport: (id: string): Promise<RateLimitResult> =>
    consume({ key: 'pdf-export', limit: 3, windowSec: 60 }, id),
  /** Admin mutations (POST/PATCH/PUT/DELETE under `/api/v1/admin/*`):
   *  60 / minute per admin. Defence-in-depth against a stolen admin
   *  session/cookie — bulk-edit scripting is throttled. Read-only GETs
   *  are intentionally NOT rate-limited so admins can browse freely. */
  adminMutation: (id: string): Promise<RateLimitResult> =>
    consume({ key: 'admin-mutation', limit: 60, windowSec: 60 }, id),
  /** Generic fallback: 60 / minute. */
  default: (id: string): Promise<RateLimitResult> =>
    consume({ key: 'default', limit: 60, windowSec: 60 }, id),
} as const
