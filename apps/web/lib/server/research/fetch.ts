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
 * SSRF guard — refuse URLs that would resolve to internal/loopback/link-local
 * addresses. Without this, a DDG result that 301s to `http://169.254.169.254/`
 * (AWS instance metadata), `http://127.0.0.1:6379` (loopback Redis), or
 * `http://10.0.0.1/` (private LAN) would be happily fetched and parsed.
 *
 * Two layers:
 *   1. Scheme + literal-IP/hostname check on the input URL (cheap, deterministic).
 *   2. DNS lookup on the hostname; if any resolved A/AAAA is private/loopback,
 *      reject. This catches `internal.example.com` pointing at 10.0.0.1.
 *
 * Both `fetchPage`'s input URL AND any redirect target need this. The
 * standard `fetch` honours `redirect: 'follow'` server-side without giving
 * us a hook to vet each hop, so we switch to `redirect: 'manual'` and
 * re-validate each hop (max 5 hops) ourselves.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

const PRIVATE_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
])

/** Refuse all the standard non-routable / metadata IP ranges. */
function isPrivateIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) {
    const [a, b] = ip.split('.').map((p) => Number(p))
    if (a === undefined || b === undefined) return true
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true // link-local incl. AWS/GCP metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // shared CGNAT
    if (a >= 224) return true // multicast / reserved / broadcast
    return false
  }
  if (family === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::' || lower === '::ffff:0:0') return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true // ULA
    if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9')) return true // link-local
    if (lower.startsWith('ff')) return true // multicast
    // IPv4-mapped (::ffff:a.b.c.d) — extract the v4 and re-check.
    const v4mapped = lower.match(/^::ffff:([0-9.]+)$/)
    if (v4mapped && v4mapped[1]) return isPrivateIp(v4mapped[1]!)
    return false
  }
  return false
}

async function assertPublicUrl(url: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new FetchError(url, null, 'invalid URL')
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new FetchError(url, null, `scheme not allowed: ${parsed.protocol}`)
  }
  const host = parsed.hostname.toLowerCase()
  if (!host || PRIVATE_HOSTNAMES.has(host)) {
    throw new FetchError(url, null, `private hostname blocked: ${host}`)
  }
  // Literal IP shortcut — no DNS round trip needed.
  if (isIP(host)) {
    if (isPrivateIp(host)) {
      throw new FetchError(url, null, `private IP blocked: ${host}`)
    }
    return
  }
  // Resolve the hostname and reject if ANY answer is private. The crawler is
  // best-effort; a single private answer is a strong "do not fetch" signal.
  // `all: true` returns the full record list; cast through the union so TS
  // accepts the array narrowing regardless of the LookupAllOptions overload
  // not picking up the `verbatim` flag cleanly.
  let answers: Array<{ address: string; family: number }>
  try {
    const raw = (await lookup(host, { all: true, verbatim: true })) as unknown
    answers = Array.isArray(raw) ? (raw as Array<{ address: string; family: number }>) : []
  } catch (err) {
    throw new FetchError(url, null, `dns lookup failed: ${(err as Error).message}`)
  }
  for (const r of answers) {
    if (isPrivateIp(r.address)) {
      throw new FetchError(url, null, `host resolves to private IP: ${host} → ${r.address}`)
    }
  }
}

/**
 * Fetch a page with rate limiting, timeout, retry-on-5xx, and SSRF guards.
 *
 * The caller still decides which URLs are research-relevant (whitelist /
 * DDG result), but every URL — including redirect targets — is vetted
 * against the public-IP allowlist below so a malicious search result that
 * 301s to a private IP can't reach internal infrastructure.
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
      // SSRF guard — vet every hop manually so a 30x redirect can't escape
      // to a private IP. Max 5 redirects (matches browser default).
      let currentUrl = url
      let res: Response | null = null
      for (let hop = 0; hop < 6; hop++) {
        await assertPublicUrl(currentUrl)
        res = await fetch(currentUrl, {
          signal: ac.signal,
          redirect: 'manual',
          headers: {
            'user-agent': 'AtharResearchBot/1.0 (+https://athar.id/bot)',
            accept: 'text/html,application/xhtml+xml',
            'accept-language': 'ar,id;q=0.9,en;q=0.8',
          },
        })
        if (res.status >= 300 && res.status < 400) {
          const next = res.headers.get('location')
          if (!next) break
          currentUrl = new URL(next, currentUrl).toString()
          continue
        }
        break
      }
      if (!res) {
        throw new FetchError(url, null, 'no response after redirect chain')
      }
      if (!res.ok) {
        // Retry once on 5xx, never on 4xx.
        if (res.status >= 500 && attempt < maxAttempts) {
          lastErr = new FetchError(url, res.status, res.statusText)
          continue
        }
        throw new FetchError(url, res.status, res.statusText)
      }
      const html = await res.text()
      return { finalUrl: res.url || currentUrl, html, status: res.status }
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
