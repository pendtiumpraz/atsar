// Better-auth catch-all Next.js route handler.
//
// Exposes every better-auth endpoint under `/api/auth/*` (sign-in,
// sign-up, verify-email, session, etc.). See:
// https://www.better-auth.com/docs/integrations/next
//
// POST is wrapped with the tiered login-lockout guard:
//   1. For email sign-in attempts we check the Redis lockout buckets
//      BEFORE delegating to better-auth. A locked email or IP returns
//      423 Locked + Retry-After.
//   2. After better-auth responds we inspect the status — non-2xx on
//      sign-in increments the fail counters; 2xx clears them. Other
//      better-auth routes pass through untouched.

import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/server/auth'
import {
  checkLockout,
  clearAttempts,
  getClientIp,
  lockoutMessage,
  recordFailedAttempt,
} from '@/lib/server/security/lockout'

const next = toNextJsHandler(auth.handler)

export const GET = next.GET

/** Match every variant better-auth exposes for email/password sign-in. */
function isSignInEmailPath(pathname: string): boolean {
  return (
    pathname.endsWith('/sign-in/email') ||
    pathname.endsWith('/sign-in/credentials')
  )
}

/** Extract the candidate email from the sign-in request body without
 *  consuming the stream the underlying handler will read. */
async function peekEmail(req: Request): Promise<string | null> {
  try {
    const cloned = req.clone()
    const body = (await cloned.json()) as Record<string, unknown>
    return typeof body['email'] === 'string' ? body['email'] : null
  } catch {
    return null
  }
}

function lockoutResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'ACCOUNT_LOCKED',
        message: lockoutMessage(retryAfterSec),
      },
    }),
    {
      status: 423,
      headers: {
        'content-type': 'application/json',
        'retry-after': String(retryAfterSec),
      },
    },
  )
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url)
  if (!isSignInEmailPath(url.pathname)) {
    return next.POST(req)
  }

  const email = await peekEmail(req)
  const ip = getClientIp(req.headers)

  // Pre-flight — block early if either bucket is already locked.
  const pre = await checkLockout(email ?? '', ip)
  if (pre.locked) return lockoutResponse(pre.retryAfterSec)

  const res = await next.POST(req)

  // Better-auth signals failed credentials with 401 (and 400 for malformed
  // input). 423 from us above already short-circuited. 2xx = success.
  if (res.status >= 200 && res.status < 300) {
    if (email) await clearAttempts(email, ip)
    return res
  }
  if (res.status === 401 || res.status === 403) {
    if (email) {
      const after = await recordFailedAttempt(email, ip)
      if (after.locked) {
        // Surface the lockout immediately instead of waiting for the next
        // attempt — admin gets a clear "X detik" message.
        return lockoutResponse(after.retryAfterSec)
      }
    }
  }
  return res
}
