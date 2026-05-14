'use server'

// Server action: return the set of role slugs for the currently-authenticated
// user. Used by the login form to choose a role-aware redirect target — the
// better-auth client session does not include role info by default.
//
// Returns an empty array if the caller is not authenticated rather than
// throwing, so the login form can fall back to `/dashboard` cleanly.

import { headers } from 'next/headers'

import { auth } from './instance.js'
import { getUserRoleSlugs } from '../rbac/permissions.js'

/**
 * Read the current user's role slugs (e.g. `['admin']`, `['reviewer']`).
 * Safe to call from a Client Component; returns `[]` for anonymous callers.
 */
export async function getMyRoleSlugs(): Promise<string[]> {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  if (!userId) return []
  const slugs = await getUserRoleSlugs(userId)
  return Array.from(slugs)
}
