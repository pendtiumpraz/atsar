// Permission-guard middleware.
// Supports TWO calling styles (to align with both swarm-agent conventions):
//   1. Direct:    await requirePermission(req, 'figures.view')   → returns { userId, session }
//   2. Curried:   await requirePermission('figures.view')(userId) → returns void
// See docs/BACKEND.md §5.2.

import { ApiError } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { limiters } from '@/lib/server/middleware/rate-limit'
import { getEffectivePermissions } from './permissions.js'

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

/**
 * Defence-in-depth: every authenticated admin mutation (POST/PATCH/PUT/
 * DELETE under /api/v1/admin/*) burns one slot from the `adminMutation`
 * limiter (60 / minute per admin). If a stolen admin session/cookie is
 * abused to mass-edit content, the burst caps at 60 requests/min before
 * the limiter throws 429. Read-only GETs are unaffected so day-to-day
 * browsing isn't throttled.
 *
 * Skipped automatically for non-admin paths and non-mutation methods.
 */
async function applyAdminMutationRateLimit(
  req: Request,
  userId: string,
): Promise<void> {
  if (!MUTATION_METHODS.has(req.method.toUpperCase())) return
  let pathname: string
  try {
    pathname = new URL(req.url).pathname
  } catch {
    return
  }
  if (!pathname.startsWith('/api/v1/admin/')) return
  await limiters.adminMutation(userId)
}

export type PermissionContext = {
  userId: string
  session: Awaited<ReturnType<typeof auth.api.getSession>>
}

/** Internal: resolve userId from request session (throws AUTH_REQUIRED if none). */
async function resolveUserId(req: Request): Promise<PermissionContext> {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    throw new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.')
  }
  return { userId, session }
}

async function check(userId: string, slug: string): Promise<void> {
  const perms = await getEffectivePermissions(userId)
  if (!perms.has(slug)) {
    throw new ApiError('PERMISSION_DENIED', `Butuh permission: ${slug}`)
  }
}

/**
 * Guard:
 *   - `await requirePermission(req, 'figures.view')` → resolves userId from session, returns PermissionContext
 *   - `await requirePermission('figures.view')(userId)` → curried factory
 */
export function requirePermission(slug: string): (userId: string) => Promise<void>
export function requirePermission(req: Request, slug: string): Promise<PermissionContext>
export function requirePermission(
  arg1: string | Request,
  slug?: string,
): ((userId: string) => Promise<void>) | Promise<PermissionContext> {
  // (req, slug)
  if (typeof arg1 !== 'string') {
    const s = slug as string
    return (async () => {
      const ctx = await resolveUserId(arg1)
      await check(ctx.userId, s)
      await applyAdminMutationRateLimit(arg1, ctx.userId)
      return ctx
    })()
  }
  // (slug) → curried
  const s = arg1
  return async (userId: string) => {
    await check(userId, s)
  }
}

/** Guard: requires at least one of the given permission slugs. */
export function requireAnyPermission(slugs: string[]): (userId: string) => Promise<void>
export function requireAnyPermission(
  req: Request,
  slugs: string[],
): Promise<PermissionContext>
export function requireAnyPermission(
  arg1: string[] | Request,
  slugs?: string[],
): ((userId: string) => Promise<void>) | Promise<PermissionContext> {
  const matchAny = async (userId: string, list: string[]) => {
    if (list.length === 0) return
    const perms = await getEffectivePermissions(userId)
    if (!list.some((s) => perms.has(s))) {
      throw new ApiError(
        'PERMISSION_DENIED',
        `Butuh salah satu permission: ${list.join(', ')}`,
      )
    }
  }
  if (!Array.isArray(arg1)) {
    const list = slugs as string[]
    return (async () => {
      const ctx = await resolveUserId(arg1)
      await matchAny(ctx.userId, list)
      return ctx
    })()
  }
  const list = arg1
  return async (userId: string) => matchAny(userId, list)
}

/** Guard: requires the user to hold every listed permission slug. */
export function requireAllPermissions(slugs: string[]): (userId: string) => Promise<void>
export function requireAllPermissions(
  req: Request,
  slugs: string[],
): Promise<PermissionContext>
export function requireAllPermissions(
  arg1: string[] | Request,
  slugs?: string[],
): ((userId: string) => Promise<void>) | Promise<PermissionContext> {
  const matchAll = async (userId: string, list: string[]) => {
    if (list.length === 0) return
    const perms = await getEffectivePermissions(userId)
    const missing = list.filter((s) => !perms.has(s))
    if (missing.length > 0) {
      throw new ApiError(
        'PERMISSION_DENIED',
        `Butuh semua permission: ${missing.join(', ')}`,
      )
    }
  }
  if (!Array.isArray(arg1)) {
    const list = slugs as string[]
    return (async () => {
      const ctx = await resolveUserId(arg1)
      await matchAll(ctx.userId, list)
      return ctx
    })()
  }
  const list = arg1
  return async (userId: string) => matchAll(userId, list)
}

/** Helper: just resolve userId without checking any permission. */
export async function requireAuth(req: Request): Promise<PermissionContext> {
  return resolveUserId(req)
}
