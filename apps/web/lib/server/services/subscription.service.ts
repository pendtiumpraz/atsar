// Subscription service — owns the lifecycle of `subscriptions` rows.
//
// Lifecycle states (see docs/BACKEND.md §2.5 + IDEAS §6.4):
//   trial    — user just signed up, 3-day grace on a paid tier
//   active   — admin confirmed payment; expires on next billing date
//   expired  — past `expiresAt`; access blocked until re-activation
//   cancelled — user requested cancel (kept for audit; not auto-set today)
//
// Quotas anchor on `quotaResetAt` and reset monthly via Agent 8's cron.
// Quota is use-it-or-lose-it — unused capacity does not roll over.

import { and, desc, eq, gt, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@athar/db'
import { subscriptions, tiers } from '@athar/db/schema'
import { TRIAL_DAYS } from '@athar/shared'

import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'

// ── Types ─────────────────────────────────────────────────────────────
export type SubscriptionRow = typeof subscriptions.$inferSelect
export type TierRow = typeof tiers.$inferSelect

export interface SubscriptionWithTier extends SubscriptionRow {
  tier: TierRow | null
}

export type BillingCycle = 'monthly' | 'yearly'
export type TierSlug = 'free' | 'sampler' | 'basic' | 'pro' | 'premium'

export interface ActivateInput {
  subscriptionId: string
  tierId: string
  billingCycle: BillingCycle
  activatedBy: string
}

export interface ListAllInput {
  status?: 'trial' | 'active' | 'expired' | 'cancelled'
  page: number
  perPage: number
}

export interface PaginatedSubscriptions {
  rows: SubscriptionWithTier[]
  total: number
  page: number
  perPage: number
}

// ── Helpers ──────────────────────────────────────────────────────────
/** Add `months` calendar months to a date, anchored to the date-of-month. */
function addMonths(date: Date, months: number): Date {
  const out = new Date(date)
  const targetDay = out.getUTCDate()
  out.setUTCMonth(out.getUTCMonth() + months)
  // Handle month-overflow (e.g. Jan 31 + 1 month → Mar 3 instead of Feb 28).
  // If the day got bumped, snap to the last day of the intended month.
  if (out.getUTCDate() < targetDay) {
    out.setUTCDate(0)
  }
  return out
}

/** Add `days` to a date (UTC). */
function addDays(date: Date, days: number): Date {
  const out = new Date(date)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

async function getTierBySlug(slug: TierSlug): Promise<TierRow> {
  const tier = await db.query.tiers.findFirst({
    where: and(eq(tiers.slug, slug), isNull(tiers.deletedAt)),
  })
  if (!tier) throw new ApiError('NOT_FOUND', `Tier not found: ${slug}`)
  return tier
}

async function getTierById(id: string): Promise<TierRow> {
  const tier = await db.query.tiers.findFirst({
    where: and(eq(tiers.id, id), isNull(tiers.deletedAt)),
  })
  if (!tier) throw new ApiError('NOT_FOUND', `Tier not found: ${id}`)
  return tier
}

// ── Create trial ──────────────────────────────────────────────────────
/**
 * Provision a TRIAL_DAYS-day trial of `tierSlug` for `userId`.
 *
 * The trial counts as an "active" subscription for access-control purposes
 * (status='trial') but does NOT seed quota rows — quota service will lazily
 * create them on first use against `quotaResetAt`.
 */
export async function createTrial(
  userId: string,
  tierSlug: TierSlug = 'premium',
): Promise<SubscriptionRow> {
  const tier = await getTierBySlug(tierSlug)

  const now = new Date()
  const trialUntil = addDays(now, TRIAL_DAYS)

  const [inserted] = await db
    .insert(subscriptions)
    .values({
      userId,
      tierId: tier.id,
      status: 'trial',
      startedAt: now,
      trialUntil,
      // Quota window opens immediately and lasts a full month so trial users
      // can taste the paid quota without quirky pro-ration math.
      quotaResetAt: addMonths(now, 1),
      expiresAt: trialUntil,
      autoRenew: false,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()

  if (!inserted) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to create trial subscription')
  }

  await auditLog.write({
    actorId: userId,
    actorRole: 'system',
    action: 'create',
    resourceType: 'subscription',
    resourceId: inserted.id,
    diff: { after: { status: 'trial', tierSlug, trialUntil } },
  })

  return inserted
}

// ── Get active sub for a user ────────────────────────────────────────
/**
 * Resolve the user's current access-granting subscription, if any.
 *
 * Returns the most recent non-deleted row with status in (trial|active) whose
 * `expiresAt` is in the future. `null` if the user has no usable plan.
 */
export async function getActive(userId: string): Promise<SubscriptionWithTier | null> {
  const now = new Date()
  const row = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      isNull(subscriptions.deletedAt),
      inArray(subscriptions.status, ['trial', 'active']),
      or(isNull(subscriptions.expiresAt), gt(subscriptions.expiresAt, now)),
    ),
    orderBy: [desc(subscriptions.createdAt)],
  })
  if (!row) return null

  const tier = await db.query.tiers.findFirst({
    where: eq(tiers.id, row.tierId),
  })

  return { ...row, tier: tier ?? null }
}

// ── Activate ──────────────────────────────────────────────────────────
/**
 * Admin-only: flip a subscription to `active` after manual payment review.
 *
 * Sets startedAt = now, expiresAt = now + 1 (month|year), and resets the
 * quota anchor to now + 1 month so the next cron pass opens a fresh window.
 *
 * Idempotent for already-active rows with the same tier+cycle: returns the
 * row unchanged (no audit row). Callers must ensure caller has the
 * `subscriptions.activate` permission.
 */
export async function activate(input: ActivateInput): Promise<SubscriptionRow> {
  const { subscriptionId, tierId, billingCycle, activatedBy } = input

  const before = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.id, subscriptionId), isNull(subscriptions.deletedAt)),
  })
  if (!before) {
    throw new ApiError('NOT_FOUND', `Subscription not found: ${subscriptionId}`)
  }

  // Validate the tier exists & is active.
  const tier = await getTierById(tierId)

  // Idempotency short-circuit.
  if (
    before.status === 'active' &&
    before.tierId === tierId &&
    before.billingCycle === billingCycle &&
    before.expiresAt &&
    before.expiresAt.getTime() > Date.now()
  ) {
    return before
  }

  const now = new Date()
  const expiresAt = billingCycle === 'yearly' ? addMonths(now, 12) : addMonths(now, 1)
  const quotaResetAt = addMonths(now, 1)

  const [updated] = await db
    .update(subscriptions)
    .set({
      tierId: tier.id,
      status: 'active',
      billingCycle,
      startedAt: now,
      expiresAt,
      quotaResetAt,
      activatedBy,
      activatedAt: now,
      updatedBy: activatedBy,
      updatedAt: now,
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning()

  if (!updated) {
    throw new ApiError('INTERNAL_ERROR', 'Failed to activate subscription')
  }

  await auditLog.write({
    actorId: activatedBy,
    actorRole: 'admin',
    action: 'update',
    resourceType: 'subscription',
    resourceId: updated.id,
    diff: {
      status: [before.status, 'active'],
      tierId: [before.tierId, tier.id],
      billingCycle: [before.billingCycle, billingCycle],
      expiresAt: [before.expiresAt, expiresAt],
    },
  })

  return updated
}

// ── Expire ────────────────────────────────────────────────────────────
/**
 * Flip a subscription to `expired`. Intended for the cron job that runs at
 * the boundary of `expiresAt`. Safe to call repeatedly.
 */
export async function expire(subscriptionId: string): Promise<void> {
  const before = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.id, subscriptionId), isNull(subscriptions.deletedAt)),
  })
  if (!before) {
    throw new ApiError('NOT_FOUND', `Subscription not found: ${subscriptionId}`)
  }
  if (before.status === 'expired') return

  await db
    .update(subscriptions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))

  await auditLog.write({
    actorRole: 'system',
    action: 'update',
    resourceType: 'subscription',
    resourceId: subscriptionId,
    diff: { status: [before.status, 'expired'] },
  })
}

// ── List (admin) ──────────────────────────────────────────────────────
/**
 * Paginated list of subscriptions. Admin-facing; route layer enforces the
 * `subscriptions.view` permission.
 */
export async function listAll(input: ListAllInput): Promise<PaginatedSubscriptions> {
  const { status, page, perPage } = input
  const offset = (page - 1) * perPage

  const filters: SQL[] = [isNull(subscriptions.deletedAt)]
  if (status) filters.push(eq(subscriptions.status, status))
  const whereExpr = and(...filters)

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        sub: subscriptions,
        tier: tiers,
      })
      .from(subscriptions)
      .leftJoin(tiers, eq(tiers.id, subscriptions.tierId))
      .where(whereExpr)
      .orderBy(desc(subscriptions.createdAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(whereExpr),
  ])

  const joined: SubscriptionWithTier[] = rows.map((r) => ({ ...r.sub, tier: r.tier }))

  return {
    rows: joined,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

export const subscriptionService = {
  createTrial,
  getActive,
  activate,
  expire,
  listAll,
}
