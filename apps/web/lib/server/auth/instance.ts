// Better-auth runtime instance.
//
// Wires our Drizzle DB + plural table schema (users, sessions, accounts,
// verifications, …) into better-auth's drizzle adapter. Field mappings
// translate between better-auth's canonical names (e.g. `name`, `image`)
// and our column names (`full_name`, `avatar_url`).
//
// Schema notes:
//   - `users.emailVerified` (boolean) is the field better-auth reads;
//     `users.emailVerifiedAt` (timestamp) is preserved alongside for audit.
//   - `accounts` holds password hashes for the credential provider and
//     OAuth tokens for social providers (one row per linked identity).
//   - `verifications` stores email-verification / magic-link / reset
//     tokens used by better-auth internally.
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
  // We pass plural model names explicitly via each entity's `modelName`
  // (users / sessions / accounts / verifications), so usePlural MUST be
  // false — otherwise the adapter doubles up and looks for "userss".
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),

  emailAndPassword: authConfig.emailAndPassword,
  advanced: {
    ...authConfig.advanced,
    // Our schema uses `uuid` columns for every `id` (users, sessions, accounts,
    // verifications). Better-auth's default ID generator emits 32-char nanoid
    // strings that fail Postgres UUID validation. Force RFC-4122 UUIDs so the
    // INSERT succeeds.
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  // Better-auth's drizzle adapter resolves columns via the Drizzle table's
  // JS property keys (camelCase) — NOT the underlying SQL column names. Our
  // schema already uses camelCase keys that match better-auth's canonical
  // field names (userId, emailVerified, expiresAt, etc.), so the only fields
  // that genuinely need re-mapping are the two whose Drizzle key differs
  // from better-auth's expected name: `name` (we use `fullName`) and `image`
  // (we use `avatarUrl`).
  //
  // Previously we passed snake_case SQL names (`full_name`, `user_id`, …)
  // which caused `table[fieldName]` lookups to resolve to `undefined` and
  // crashed sign-in with a 500. See commit history for the diagnosis.
  user: {
    modelName: 'users',
    fields: {
      name: 'fullName',
      image: 'avatarUrl',
    },
  },
  session: {
    modelName: 'sessions',
    expiresIn: authConfig.session.expiresIn,
    updateAge: authConfig.session.updateAge,
    cookieCache: authConfig.session.cookieCache,
    // Better-auth writes the session token under the field name `token`;
    // our Drizzle key is `tokenHash`. Without this mapping the adapter
    // crashes at `checkMissingFields` and returns a 500 with empty body.
    fields: {
      token: 'tokenHash',
    },
  },
  account: {
    modelName: 'accounts',
  },
  verification: {
    modelName: 'verifications',
  },

  // `nextCookies()` must be the *last* plugin so it can flush Set-Cookie
  // headers on server actions. See better-auth Next.js integration docs.
  plugins: [nextCookies()],
})

export type Auth = typeof auth
export type Session = Auth['$Infer']['Session']
