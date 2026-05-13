// Effective-permission resolution for RBAC.
// See docs/BACKEND.md §5.2–§5.4. Each user's effective permission set is the
// union of permission slugs across all roles assigned to that user. The
// resolved set is cached in Upstash Redis at `perms:user:<id>` for 5 minutes
// and invalidated whenever the user's role assignments change.

import { and, eq, isNull } from 'drizzle-orm'
import { db, schema } from '@athar/db'
import { redis } from '@/lib/server/upstash'

const { userRoles, roles, rolePermissions, permissions } = schema

const CACHE_PREFIX = 'perms:user:'
const CACHE_TTL_SECONDS = 300 // 5 minutes

/** Build the Redis cache key for a user's effective permission slugs. */
function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`
}

/**
 * Resolve the union of permission slugs granted to `userId` via their roles.
 * Reads through Upstash Redis (`perms:user:<id>`, TTL 300s) and falls back to
 * a single JOIN query against `user_roles → roles → role_permissions → permissions`.
 */
export async function getEffectivePermissions(userId: string): Promise<Set<string>> {
  const key = cacheKey(userId)

  // 1. Try cache. Upstash decodes JSON automatically; we wrote a string[].
  const cached = await redis.get<string[] | null>(key)
  if (Array.isArray(cached)) {
    return new Set(cached)
  }

  // 2. Cache miss — query the database. Filter out soft-deleted rows on the
  // joined tables so revoked roles/permissions don't leak into the result.
  const rows = await db
    .select({ slug: permissions.slug })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), isNull(roles.deletedAt)))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(
      permissions,
      and(eq(permissions.id, rolePermissions.permissionId), isNull(permissions.deletedAt)),
    )
    .where(eq(userRoles.userId, userId))

  const slugs = new Set<string>()
  for (const row of rows) {
    slugs.add(row.slug)
  }

  // 3. Write through with TTL. Store as plain array for JSON round-trip.
  await redis.set(key, Array.from(slugs), { ex: CACHE_TTL_SECONDS })

  return slugs
}

/** Drop the cached permission set for `userId`. Call after role changes. */
export async function invalidatePermissions(userId: string): Promise<void> {
  await redis.del(cacheKey(userId))
}

/** Convenience: resolve permissions and test membership in a single call. */
export async function hasPermission(userId: string, slug: string): Promise<boolean> {
  const perms = await getEffectivePermissions(userId)
  return perms.has(slug)
}

/**
 * Return the set of role slugs assigned to `userId` (e.g. `admin`,
 * `reviewer`, `subscriber`). Used by the app shell to short-circuit the
 * subscription gate for staff accounts — admins/reviewers do not need a
 * paid plan to access the app.
 */
export async function getUserRoleSlugs(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), isNull(roles.deletedAt)))
    .where(eq(userRoles.userId, userId))
  return new Set(rows.map((r) => r.slug))
}
