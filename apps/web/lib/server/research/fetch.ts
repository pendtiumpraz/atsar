// Rate-limited HTTP fetcher for the Deep Research crawler.
//
// Responsibilities:
// - Per-domain sliding-window rate limiting (Upstash Redis) so we don't get
//   banned from whitelist sources (`whitelist_domains.crawl_rate_per_minute`).
// - Sane 15s timeout via AbortController.
// - Light retry on transient 5xx / network errors.
// - Return the final URL (after redirects) + raw HTML body.
//
// Errors thrown:
// - `RateLimitExceededError` — caller should back off / requeue with a delay.
// - `FetchError` — non-2xx or network failure after retries.

import { redis } from '@/lib/server/upstash'

/** Thrown when the per-domain rate limit is hit. */
export class RateLimitExceededError extends Error {
  public readonly code = 'RATE_LIMIT_EXCEEDED'
  public readonly domain: string
  public readonly retryAfterMs: number
  constructor(domain: string, retryAfterMs: number) {
    super(`rate limit exceeded for ${domain} — retry in ${retryAfterMs}ms`)
    this.name = 'RateLimitExceededError'
    this.domain = domain
    this.retryAfterMs = retryAfterMs
    Object.setPrototypeOf(this, RateLimitExceededError.prototype)
  }
}

/** Thrown for non-2xx responses or network/timeout failures after retries. */
export class FetchError extends Error {
  public readonly code = 'FETCH_FAILED'
  public readonly status: number | null
  public readonly url: string
  constructor(url: string, status: number | null, message: string) {
    super(`fetch failed (${status ?? 'network'}): ${url} — ${message}`)
    this.name = 'FetchError'
    this.url = url
    this.status = status
    Object.setPrototypeOf(this, FetchError.prototype)
  }
}

export interface FetchPageOptions {
  /** Override the rate-limit bucket key. Defaults to the URL host. */
  rateLimitKey?: string
  /** Hard ceiling on the request, default 15_000ms. */
  timeoutMs?: number
  /** Max attempts for transient failures (defaults to 2). */
  maxAttempts?: number
  /** Max requests per minute for the bucket. Defaults to 30 (matches `whitelist_domains` default). */
  maxPerMinute?: number
}

export interface FetchPageResult {
  /** URL that actually served the response (post-redirect). */
  finalUrl: string
  /** Raw response body as UTF-8 text — caller decides how to parse it. */
  html: string
  /** HTTP status code. */
  status: number
}

const WINDOW_SEC = 60

/**
 * Reserve one slot in the per-domain sliding window. Throws
 * `RateLimitExceededError` when the cap is hit.
 *
 * Implementation: INCR + EXPIRE on a 60-second-bucketed key. Not a true
 * sliding window (it's a fixed-window over 60s) but cheap and good enough
 * for crawl pacing. Replace with `@upstash/ratelimit` if precision matters.
 */
async function reserveSlot(key: string, maxPerMinute: number): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000 / WINDOW_SEC)
  const redisKey = `crawl:rl:${key}:${bucket}`
  const count = await redis.incr(redisKey)
  if (count === 1) {
    // First hit in this bucket — set TTL slightly above the window so the
    // key auto-evicts. Best-effort: if EXPIRE fails the key will still
    // expire via the next bucket transition.
    await redis.expire(redisKey, WINDOW_SEC + 5)
  }
  if (count > maxPerMinute) {
    const msIntoBucket = (Date.now() / 1000) % WINDOW_SEC
    const retryAfterMs = Math.max(250, Math.ceil((WINDOW_SEC - msIntoBucket) * 1000))
    throw new RateLimitExceededError(key, retryAfterMs)
  }
}

/** Lower-case host with no port, or null if URL is malformed. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Fetch a page with rate limiting, timeout, and basic retry-on-5xx.
 *
 * The caller (research orchestrator) is responsible for deciding which URLs
 * to fetch — this function trusts whatever it's given. Whitelist enforcement
 * happens upstream when candidate URLs are generated.
 */
export async function fetchPage(
  url: string,
  opts: FetchPageOptions = {},
): Promise<FetchPageResult> {
  const host = hostOf(url)
  if (!host) {
    throw new FetchError(url, null, 'invalid URL')
  }
  const rateLimitKey = opts.rateLimitKey ?? host
  const timeoutMs = opts.timeoutMs ?? 15_000
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 2)
  const maxPerMinute = Math.max(1, opts.maxPerMinute ?? 30)

  // Reserve before issuing the request so a burst of fetches respects the
  // cap even if individual requests take a while.
  await reserveSlot(rateLimitKey, maxPerMinute)

  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        redirect: 'follow',
        headers: {
          'user-agent': 'AtharResearchBot/1.0 (+https://athar.id/bot)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ar,id;q=0.9,en;q=0.8',
        },
      })
      if (!res.ok) {
        // Retry once on 5xx, never on 4xx.
        if (res.status >= 500 && attempt < maxAttempts) {
          lastErr = new FetchError(url, res.status, res.statusText)
          continue
        }
        throw new FetchError(url, res.status, res.statusText)
      }
      const html = await res.text()
      return { finalUrl: res.url || url, html, status: res.status }
    } catch (err) {
      if (err instanceof FetchError) throw err
      const message = err instanceof Error ? err.message : String(err)
      lastErr = new FetchError(url, null, message)
      if (attempt >= maxAttempts) throw lastErr
    } finally {
      clearTimeout(t)
    }
  }
  // Unreachable in practice — the loop either returns or throws.
  throw lastErr ?? new FetchError(url, null, 'unknown fetch failure')
}
