/**
 * Better-auth client SDK for the browser.
 *
 * Wraps `createAuthClient` from `better-auth/react` so any page/component can
 * call `authClient.signIn.email(...)` / `signUp.email(...)` / `verifyEmail(...)`
 * etc. against the catch-all handler at `/api/auth/*`.
 *
 * `NEXT_PUBLIC_APP_URL` is optional — when omitted, better-auth derives the
 * base URL from `window.location` at request time, which is fine for SPA use.
 */

import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient({
  baseURL: process.env['NEXT_PUBLIC_APP_URL'] ?? '',
})

export const { useSession, signIn, signUp, signOut } = authClient
