// Tiered login lockout — Redis-backed counter + lockout-until timestamps.
//
// Counters and lockout state are stored in Upstash Redis (with graceful
// degradation: every redis call is wrapped at `lib/server/upstash/redis.ts`
// and returns 0 / null on quota exhaustion). All thresholds and durations
// are read from `security_settings` (see security.service.ts) so an admin
// can retune live via /admin/security without a redeploy.
//
// Keying strategy (per spec): we maintain two parallel counters — one by
// email, one by remote IP. Whichever crosses a tier threshold first
// triggers the lockout for that identifier. Both keys must be unlocked
// for a sign-in attempt to proceed; both are reset on success.
//
// Key layout:
//   login:fail:email:<lowercase-email>    INCR + EXPIRE attemptWindowSec
//   login:fail:ip:<ip>                    INCR + EXPIRE attemptWindowSec
//   login:lockout:email:<lowercase-email> SETEX <durationSec> '1'
//   login:lockout:ip:<ip>                 SETEX <durationSec> '1'
//
// The lockout key's TTL doubles as the retry-after — we read it with
// `pttl` / `ttl` so the client gets accurate "X detik" feedback.

import { redis } from '@/lib/server/upstash/redis'
import {
  getLockoutConfig,
  SECURITY_DEFAULTS,
  type LockoutConfig,
} from '@/lib/server/services/security.service'

/** Buckets we count failed attempts for. */
type Identifier =
  | { kind: 'email'; value: string }
  | { kind: 'ip'; value: string }

/** Result of a pre-signin check. */
export type LockoutCheck =
  | { locked: false }
  | { locked: true; retryAfterSec: number; reason: 'email' | 'ip' }

function normalize(id: Identifier): Identifier {
  if (id.kind === 'email') return { kind: 'email', value: id.value.trim().toLowerCase() }
  return id
}

function failKey(id: Identifier): string {
  return `login:fail:${id.kind}:${id.value}`
}

function lockoutKey(id: Identifier): string {
  return `login:lockout:${id.kind}:${id.value}`
}

/**
 * Pick the highest-tier lockout duration matching `count` failures.
 * Returns `null` when no tier has been crossed (count < tier1Threshold).
 */
function pickTierDurationSec(count: number, cfg: LockoutConfig): number | null {
  if (count >= cfg.loginLockoutTier3Threshold) return cfg.loginLockoutTier3DurationSec
  if (count >= cfg.loginLockoutTier2Threshold) return cfg.loginLockoutTier2DurationSec
  if (count >= cfg.loginLockoutTier1Threshold) return cfg.loginLockoutTier1DurationSec
  return null
}

/**
 * Resolve the remote IP from a Headers or Request. Mirrors better-auth's
 * `getIp` heuristic but kept local so this module has no better-auth
 * runtime dependency. Returns `'unknown'` (a constant string) when no
 * forwarded-for / real-ip header is present so the IP bucket still
 * accumulates — better to false-positive a NATed crowd than to disable
 * the IP brake entirely.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const cf = headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  return 'unknown'
}

/**
 * Check whether `email` or `ip` is currently locked out. Returns the
 * retry-after in seconds for whichever bucket is locked (prefers email
 * since that is the most likely human-visible reason).
 */
export async function checkLockout(
  email: string,
  ip: string,
): Promise<LockoutCheck> {
  const emailId = normalize({ kind: 'email', value: email })
  const ipId = normalize({ kind: 'ip', value: ip })

  // `ttl` returns:  -2 if key does not exist
  //                 -1 if key exists with no TTL
  //                 >=0 remaining seconds
  // Our graceful-degrade proxy returns 0 on Redis error → treated as "not locked".
  const [emailTtl, ipTtl] = await Promise.all([
    redis.ttl(lockoutKey(emailId)),
    redis.ttl(lockoutKey(ipId)),
  ])

  if (typeof emailTtl === 'number' && emailTtl > 0) {
    return { locked: true, retryAfterSec: emailTtl, reason: 'email' }
  }
  if (typeof ipTtl === 'number' && ipTtl > 0) {
    return { locked: true, retryAfterSec: ipTtl, reason: 'ip' }
  }
  return { locked: false }
}

/**
 * Record a failed attempt for both buckets, escalating to a lockout when
 * a tier threshold is crossed. Returns a `LockoutCheck` reflecting the
 * NEW state — if this failure tripped a tier, the caller can surface the
 * lockout message immediately.
 */
export async function recordFailedAttempt(
  email: string,
  ip: string,
): Promise<LockoutCheck> {
  const cfg = await getLockoutConfig().catch(() => ({ ...SECURITY_DEFAULTS }))

  const emailId = normalize({ kind: 'email', value: email })
  const ipId = normalize({ kind: 'ip', value: ip })

  const [emailCount, ipCount] = await Promise.all([
    bumpCounter(emailId, cfg.attemptWindowSec),
    bumpCounter(ipId, cfg.attemptWindowSec),
  ])

  // Tier-pick per bucket separately — whichever has earned the highest
  // duration drives the lockout for that bucket.
  const emailDur = pickTierDurationSec(emailCount, cfg)
  const ipDur = pickTierDurationSec(ipCount, cfg)

  if (emailDur !== null) {
    await redis.set(lockoutKey(emailId), '1', { ex: emailDur })
  }
  if (ipDur !== null) {
    await redis.set(lockoutKey(ipId), '1', { ex: ipDur })
  }

  // Surface whichever lockout will keep the user out longest — the email
  // lockout takes precedence when both are equal.
  if (emailDur !== null && (ipDur === null || emailDur >= ipDur)) {
    return { locked: true, retryAfterSec: emailDur, reason: 'email' }
  }
  if (ipDur !== null) {
    return { locked: true, retryAfterSec: ipDur, reason: 'ip' }
  }
  return { locked: false }
}

/**
 * Increment the rolling counter for an identifier. The TTL is (re)set on
 * every increment so the window slides forward — equivalent to a rolling
 * window with second-level precision.
 */
async function bumpCounter(id: Identifier, windowSec: number): Promise<number> {
  const key = failKey(id)
  // `incr` returns the post-increment value. Our graceful-degrade proxy
  // returns 0 on Redis error → treated as "no escalation this round",
  // which fails open (login proceeds). This is the desired behaviour:
  // Redis being down should never lock everyone out.
  const raw = await redis.incr(key)
  const count = typeof raw === 'number' ? raw : 0
  if (count > 0) {
    // Re-arm TTL on every hit so the rolling window keeps sliding.
    await redis.expire(key, windowSec)
  }
  return count
}

/**
 * Clear both buckets after a successful login.
 */
export async function clearAttempts(email: string, ip: string): Promise<void> {
  const emailId = normalize({ kind: 'email', value: email })
  const ipId = normalize({ kind: 'ip', value: ip })
  await Promise.all([
    redis.del(failKey(emailId)),
    redis.del(failKey(ipId)),
    redis.del(lockoutKey(emailId)),
    redis.del(lockoutKey(ipId)),
  ])
}

/**
 * Indonesian-localised error message for a locked-out response.
 */
export function lockoutMessage(retryAfterSec: number): string {
  return `Akun terkunci sementara, coba lagi dalam ${retryAfterSec} detik`
}
