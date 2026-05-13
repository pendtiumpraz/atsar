// Subscription gate — request-time access guard.
//
// This sits *above* RBAC (permissions): a user may legitimately have a
// permission slug (e.g. `figures.view`) but still be blocked from a
// paid-tier resource because their subscription has lapsed.
//
// Two entry points:
//   - `requireActiveSubscription(req)` — for route handlers; throws
//     `SUBSCRIPTION_EXPIRED` (HTTP 402) if there is no usable plan.
//   - `getActiveSubscription(userId)` — pure lookup, returns null when
//     there is no usable plan.  Use this when the caller wants to render
//     a paywall / upsell UI instead of erroring out.
//
// "Usable plan" = a non-deleted `subscriptions` row whose status is
// `trial` or `active` AND whose `expiresAt` (or `trialUntil`) is in the
// future. We always pick the most recent row to handle users that
// upgrade/downgrade mid-cycle.
//
// See docs/IDEAS.md §6.7 (Tier Akses) and docs/BACKEND.md §5.

import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { subscriptions, tiers } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { auth } from './instance.js'

// ── Types ─────────────────────────────────────────────────────────────

export type TierSlug = 'free' | 'sampler' | 'basic' | 'pro' | 'premium'
export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

export interface ContentScope {
  categories: string[]
  curatedFigureIds?: string[]
  curatedCount?: Record<string, number>
}

export interface ActiveSubscription {
  userId: string
  tierSlug: TierSlug
  tierId: string
  status: SubscriptionStatus
  expiresAt: Date | null
  contentScope: ContentScope
}

// ── Internal helpers ──────────────────────────────────────────────────

/**
 * Decide whether a `(status, expiresAt)` pair counts as "usable right now".
 * Trial and active are the only statuses that grant access. `expiresAt`
 * may be null (e.g. legacy rows) — treat that as "no expiry yet" rather
 * than blocking.
 */
function isUsable(status: SubscriptionStatus, expiresAt: Date | null, now: Date): boolean {
  if (status !== 'active' && status !== 'trial') return false
  if (expiresAt === null) return true
  return expiresAt.getTime() > now.getTime()
}

/** Normalize the JSONB content_scope into a stable shape. */
function normalizeScope(raw: unknown): ContentScope {
  if (!raw || typeof raw !== 'object') return { categories: [] }
  const obj = raw as Partial<ContentScope>
  const out: ContentScope = {
    categories: Array.isArray(obj.categories) ? obj.categories.slice() : [],
  }
  if (Array.isArray(obj.curatedFigureIds)) {
    out.curatedFigureIds = obj.curatedFigureIds.slice()
  }
  if (obj.curatedCount && typeof obj.curatedCount === 'object') {
    out.curatedCount = { ...obj.curatedCount }
  }
  return out
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Lookup-only variant: returns the user's currently-usable subscription
 * or `null` if there is none / it has expired. Does NOT throw.
 *
 * Use this when the caller wants to fall back to a paywall, not error.
 */
export async function getActiveSubscription(
  userId: string,
): Promise<ActiveSubscription | null> {
  const now = new Date()

  // Pick the most recent non-deleted row regardless of status so we can
  // report 'expired' accurately to callers that care; but only return
  // the projection when it's actually usable.
  const rows = await db
    .select({
      sub: subscriptions,
      tier: tiers,
    })
    .from(subscriptions)
    .leftJoin(tiers, eq(tiers.id, subscriptions.tierId))
    .where(and(eq(subscriptions.userId, userId), isNull(subscriptions.deletedAt)))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1)

  const row = rows[0]
  if (!row || !row.tier) return null

  const status = row.sub.status as SubscriptionStatus
  const expiresAt = row.sub.expiresAt ?? null

  if (!isUsable(status, expiresAt, now)) return null

  return {
    userId,
    tierSlug: row.tier.slug as TierSlug,
    tierId: row.tier.id,
    status,
    expiresAt,
    contentScope: normalizeScope(row.tier.contentScope),
  }
}

/**
 * Throw-on-failure variant: resolves the session from the request,
 * fetches the user's current subscription, and throws
 * `ApiError('SUBSCRIPTION_EXPIRED')` (HTTP 402) if the plan is missing
 * or expired.
 *
 * Route handlers should pair this with `requirePermission` — RBAC
 * checks role-based capability, this checks billing state.
 */
export async function requireActiveSubscription(req: Request): Promise<ActiveSubscription> {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    throw new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.')
  }

  const active = await getActiveSubscription(userId)
  if (!active) {
    throw new ApiError(
      'SUBSCRIPTION_EXPIRED',
      'Langganan Anda tidak aktif. Silakan perpanjang untuk melanjutkan.',
    )
  }
  return active
}
