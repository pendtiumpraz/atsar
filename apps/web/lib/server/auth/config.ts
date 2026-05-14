// Better-auth configuration. See docs/BACKEND.md §5.1.
//
// Defines the static option bag passed into `betterAuth()` in `instance.ts`.
// Secrets and base URL are read lazily from `process.env` so that importing
// this module does not throw at build/edge bundling time on Vercel.
//
// NOTE (future): magic link & OAuth (Google) providers will be wired in here
// alongside the existing email+password configuration once we have transport
// (email) and OAuth client credentials. Keep the shape stable.

import bcrypt from 'bcryptjs'

/**
 * Parse a comma-separated `TRUSTED_ORIGINS` env var into a list of origins.
 * Returns `undefined` when the env var is absent so better-auth falls back to
 * its `baseURL`-based defaults.
 */
function parseTrustedOrigins(): string[] | undefined {
  const raw = process.env['TRUSTED_ORIGINS']
  if (!raw) return undefined
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return list.length > 0 ? list : undefined
}

/**
 * Shape of the better-auth options we hand off to `betterAuth()`.
 *
 * Kept as a plain object literal (not typed as `BetterAuthOptions`) so the
 * concrete literal types flow through to the resulting `auth` instance —
 * this gives consumers (e.g. `auth.api.*`) precise inferred types.
 */
export const authConfig = {
  // Cryptographic secret used to sign session tokens, CSRF cookies, etc.
  // Read lazily — the env var is required at runtime, not at import time.
  get secret(): string {
    return process.env['BETTER_AUTH_SECRET'] ?? ''
  },

  // Canonical base URL for callback/verification links.
  get baseURL(): string {
    return process.env['BETTER_AUTH_URL'] ?? ''
  },

  // Additional trusted origins (optional). Comma-separated env var.
  trustedOrigins: parseTrustedOrigins(),

  emailAndPassword: {
    enabled: true,
    // Email verification is mandatory before subscription becomes active.
    // See BACKEND.md §5.1.
    requireEmailVerification: true,
    // Length floor enforced by better-auth itself. The wrapper in
    // app/api/auth/[...all]/route.ts adds extra complexity rules (letter
    // + digit, banned common-password list, anti-sequential) so a 12-char
    // monolithic check happens at the gateway. NIST 800-63B priorities:
    // length > forced character classes.
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
    // Vercel-compatible password hashing. Native Argon2 is not allowed on
    // the Vercel runtime, so we use bcryptjs (pure JS, edge-safe).
    password: {
      hash: async (password: string): Promise<string> => {
        return bcrypt.hash(password, 12)
      },
      verify: async ({ hash, password }: { hash: string; password: string }): Promise<boolean> => {
        return bcrypt.compare(password, hash)
      },
    },
  },

  session: {
    // Cookie-based sessions, 30 days expiry.
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh every 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  // Per docs/BACKEND.md: cookies are HTTP-only & SameSite=Lax — better-auth
  // applies these defaults; we just ensure Secure cookies in production.
  advanced: {
    useSecureCookies: process.env['NODE_ENV'] === 'production',
  },
}

export type AuthConfig = typeof authConfig
