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
  // `usePlural: true` because our exported keys are `users`, `sessions`, etc.
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),

  emailAndPassword: authConfig.emailAndPassword,
  advanced: authConfig.advanced,

  // Map better-auth's canonical fields onto our column names. All four
  // tables better-auth touches (users, sessions, accounts, verifications)
  // are listed so the adapter can resolve snake_case columns.
  user: {
    modelName: 'users',
    fields: {
      name: 'full_name',
      image: 'avatar_url',
      emailVerified: 'email_verified',
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
      updatedAt: 'updated_at',
    },
  },
  account: {
    modelName: 'accounts',
    fields: {
      userId: 'user_id',
      accountId: 'account_id',
      providerId: 'provider_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },

  // `nextCookies()` must be the *last* plugin so it can flush Set-Cookie
  // headers on server actions. See better-auth Next.js integration docs.
  plugins: [nextCookies()],
})

export type Auth = typeof auth
export type Session = Auth['$Infer']['Session']
