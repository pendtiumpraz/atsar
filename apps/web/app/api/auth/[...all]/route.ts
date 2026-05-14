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
import { auditLog } from '@/lib/server/services/audit.service'

const next = toNextJsHandler(auth.handler)

export const GET = next.GET

/** Match every variant better-auth exposes for email/password sign-in. */
function isSignInEmailPath(pathname: string): boolean {
  return (
    pathname.endsWith('/sign-in/email') ||
    pathname.endsWith('/sign-in/credentials')
  )
}

/** Match sign-up + password-reset endpoints so we can enforce complexity. */
function isPasswordWritePath(pathname: string): boolean {
  return (
    pathname.endsWith('/sign-up/email') ||
    pathname.endsWith('/reset-password') ||
    pathname.endsWith('/change-password')
  )
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  '123456', '1234567', '12345678', '123456789', '1234567890',
  'iloveyou', 'admin', 'admin123', 'welcome', 'welcome1',
  'letmein', 'monkey', 'dragon', 'master', 'sunshine',
  // Indonesian top picks observed in dumps.
  'rahasia', 'sayang', 'cinta', 'kucing', 'jakarta',
])

interface PasswordCheck {
  ok: boolean
  message?: string
}

/**
 * Password complexity rule. NIST 800-63B leans length-over-classes, so we
 * require 12+ chars and reject obvious patterns / common passwords. No
 * mandatory symbol — long passphrases score better than `P@ssw0rd!`.
 */
function checkPasswordComplexity(password: string): PasswordCheck {
  if (typeof password !== 'string') {
    return { ok: false, message: 'Password tidak valid.' }
  }
  if (password.length < 12) {
    return { ok: false, message: 'Password minimal 12 karakter.' }
  }
  if (password.length > 128) {
    return { ok: false, message: 'Password maksimal 128 karakter.' }
  }
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasDigit = /\d/.test(password)
  if (!hasLetter || !hasDigit) {
    return {
      ok: false,
      message: 'Password harus mengandung minimal satu huruf dan satu angka.',
    }
  }
  // All same char (aaaa…) or trivial pattern (ababab…).
  if (/^(.)\1+$/.test(password)) {
    return { ok: false, message: 'Password tidak boleh satu karakter berulang.' }
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, message: 'Password terlalu umum — pilih yang lebih unik.' }
  }
  // Sequential digits / letters (abc... / 123...) for the full length.
  if (
    /^(?:abcdefghijklmnopqrstuvwxyz|0123456789)/i.test(password) &&
    password.length < 20
  ) {
    return { ok: false, message: 'Password tidak boleh hanya urutan abjad/angka.' }
  }
  return { ok: true }
}

async function peekPassword(req: Request): Promise<string | null> {
  try {
    const cloned = req.clone()
    const body = (await cloned.json()) as Record<string, unknown>
    const candidates = ['newPassword', 'password']
    for (const key of candidates) {
      const v = body[key]
      if (typeof v === 'string') return v
    }
    return null
  } catch {
    return null
  }
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

  // Sign-up + password-reset gate: enforce complexity before better-auth
  // hashes whatever the client sent. Better-auth's `minPasswordLength`
  // alone allowed 8-char common passwords (e.g. "password").
  if (isPasswordWritePath(url.pathname)) {
    const password = await peekPassword(req)
    if (password !== null) {
      const verdict = checkPasswordComplexity(password)
      if (!verdict.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: {
              code: 'WEAK_PASSWORD',
              message: verdict.message ?? 'Password terlalu lemah.',
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        )
      }
    }
    return next.POST(req)
  }

  if (!isSignInEmailPath(url.pathname)) {
    return next.POST(req)
  }

  const email = await peekEmail(req)
  const ip = getClientIp(req.headers)
  const userAgent = req.headers.get('user-agent')

  // Pre-flight — block early if either bucket is already locked.
  const pre = await checkLockout(email ?? '', ip)
  if (pre.locked) {
    void auditLog.write({
      action: 'lockout',
      resourceType: 'auth.signin',
      ipAddress: ip === 'unknown' ? null : ip,
      userAgent,
      diff: { email, reason: pre.reason, retryAfterSec: pre.retryAfterSec },
    })
    return lockoutResponse(pre.retryAfterSec)
  }

  const res = await next.POST(req)

  // Better-auth signals failed credentials with 401 (and 400 for malformed
  // input). 423 from us above already short-circuited. 2xx = success.
  if (res.status >= 200 && res.status < 300) {
    if (email) await clearAttempts(email, ip)
    return res
  }
  if (res.status === 401 || res.status === 403) {
    void auditLog.write({
      action: 'login_failure',
      resourceType: 'auth.signin',
      ipAddress: ip === 'unknown' ? null : ip,
      userAgent,
      diff: { email, status: res.status },
    })
    if (email) {
      const after = await recordFailedAttempt(email, ip)
      if (after.locked) {
        void auditLog.write({
          action: 'lockout',
          resourceType: 'auth.signin',
          ipAddress: ip === 'unknown' ? null : ip,
          userAgent,
          diff: { email, reason: after.reason, retryAfterSec: after.retryAfterSec, escalated: true },
        })
        // Surface the lockout immediately instead of waiting for the next
        // attempt — admin gets a clear "X detik" message.
        return lockoutResponse(after.retryAfterSec)
      }
    }
  }
  return res
}
