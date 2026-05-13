// Better-auth runtime instance.
//
// Wires our Drizzle DB + plural table schema (users, sessions, …) into
// better-auth's drizzle adapter. Field mappings translate between
// better-auth's canonical names (e.g. `name`, `image`) and our column
// names (`full_name`, `avatar_url`).
//
// Note on the password column: better-auth normally stores the password
// hash on a separate `accounts` table. Our existing schema keeps the
// hash on `users.passwordHash`. The dedicated `accounts` table will be
// added in a follow-up migration; until then password-credential flows
// that require an `accounts` row will need that migration to be applied.
//
// API reference: https://www.better-auth.com/docs

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { db } from '@athar/db'

import { authConfig } from './config.js'

/**
 * Resolved better-auth instance.
 *
 * Consumers should import this via the barrel (`@/lib/server/auth`) so
 * we have a single place to swap implementations later if needed.
 */
export const auth = betterAuth({
  // Read env at request time, not import time.
  secret: authConfig.secret,
  baseURL: authConfig.baseURL,
  ...(authConfig.trustedOrigins ? { trustedOrigins: authConfig.trustedOrigins } : {}),

  // Drizzle adapter pointed at the Postgres schema exported by @athar/db.
  // `usePlural: true` because our exported keys are `users`, `sessions`, etc.
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),

  emailAndPassword: authConfig.emailAndPassword,
  advanced: authConfig.advanced,

  // Map better-auth's canonical user fields onto our existing columns.
  // Mismatches we cannot trivially bridge here:
  //   - better-auth `emailVerified: boolean` vs our `email_verified_at` (timestamp).
  //     The boolean column is referenced by better-auth internals; a future
  //     migration will add it (or replace with a generated column) alongside
  //     the timestamp we currently keep for audit purposes.
  //   - `password` is held by better-auth's `accounts` table (not present
  //     in our schema yet). See note at top of file.
  user: {
    modelName: 'users',
    fields: {
      name: 'full_name',
      image: 'avatar_url',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'sessions',
    expiresIn: authConfig.session.expiresIn,
    updateAge: authConfig.session.updateAge,
    cookieCache: authConfig.session.cookieCache,
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      // No `updated_at` column on `sessions` — a follow-up migration will
      // add it. Until then better-auth will treat it as missing.
    },
  },

  // `nextCookies()` must be the *last* plugin so it can flush Set-Cookie
  // headers on server actions. See better-auth Next.js integration docs.
  plugins: [nextCookies()],
})

export type Auth = typeof auth
export type Session = Auth['$Infer']['Session']
