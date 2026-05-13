// Quota service — owns the `quota_usage` rows that gate metered features.
//
// One row per (userId, periodStart, quotaType). The window is anchored to the
// user's anniversary (`subscription.quotaResetAt`) and is one calendar month
// long. Use-it-or-lose-it: unused capacity does NOT roll over (see IDEAS §6.4).
//
// Atomic increment uses Postgres `used_value = used_value + 1` so concurrent
// requests cannot double-spend.

import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import { quotaUsage, subscriptions, tiers } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'

import { getActive } from './subscription.service.js'

// ── Types ─────────────────────────────────────────────────────────────
export type QuotaType = 'pdf_download' | 'ai_chat' | 'ai_tokens'

export type QuotaRow = typeof quotaUsage.$inferSelect

export interface QuotaStatus {
  used: number
  limit: number
  remaining: number
}

export interface Period {
  start: Date
  end: Date
}

interface SubscriptionLike {
  quotaResetAt: Date | null
}

// ── Helpers ──────────────────────────────────────────────────────────
/** Add `months` calendar months to a date (UTC, anchored to date-of-month). */
function addMonths(date: Date, months: number): Date {
  const out = new Date(date)
  const targetDay = out.getUTCDate()
  out.setUTCMonth(out.getUTCMonth() + months)
  if (out.getUTCDate() < targetDay) {
    out.setUTCDate(0)
  }
  return out
}

/** Format a Date as a YYYY-MM-DD string for Postgres `date` columns. */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Resolve the active subscription's tier limit for the given quota type.
 * Returns -1 sentinel for unlimited (matches `tiers.downloadQuota` semantics).
 */
function tierLimitFor(tier: typeof tiers.$inferSelect, type: QuotaType): number {
  switch (type) {
    case 'pdf_download':
      return tier.downloadQuota
    case 'ai_chat':
      return tier.aiChatQuota
    case 'ai_tokens':
      // No dedicated column today — track usage but don't gate. Treat as
      // unlimited (-1) until the schema adds a per-tier ai_token quota.
      return -1
  }
}

/**
 * Compute the [start, end) window for a subscription's current quota period.
 * The end is one calendar month after `quotaResetAt`; periods are anchored
 * to the user's anniversary so they don't drift across month-end edge cases.
 */
export function getCurrentPeriod(sub: SubscriptionLike): Period {
  if (!sub.quotaResetAt) {
    // Defensive fallback: anchor at now if the subscription somehow lacks an
    // anchor. The cron will correct this on the next pass.
    const now = new Date()
    return { start: now, end: addMonths(now, 1) }
  }
  // `quotaResetAt` records the boundary of the *current* period, i.e. when
  // the window opened. The window closes one month later.
  return {
    start: sub.quotaResetAt,
    end: addMonths(sub.quotaResetAt, 1),
  }
}

// ── Ensure / read ────────────────────────────────────────────────────
/**
 * Read the user's current quota state for `type`, creating the row lazily on
 * first access. Throws `QUOTA_EXCEEDED` (HTTP 429) when `used >= limit`.
 *
 * The check is "soft" — it tells the caller "you cannot spend more right
 * now". `incrementQuota` performs the atomic write that actually decrements.
 */
export async function ensureQuota(
  userId: string,
  type: QuotaType,
): Promise<QuotaStatus> {
  const sub = await getActive(userId)
  if (!sub || !sub.tier) {
    throw new ApiError('SUBSCRIPTION_EXPIRED', 'No active subscription')
  }

  const limit = tierLimitFor(sub.tier, type)
  // -1 ⇒ unlimited. Bypass the row dance for the common case.
  if (limit === -1) {
    return { used: 0, limit: -1, remaining: Number.POSITIVE_INFINITY }
  }

  const period = getCurrentPeriod(sub)
  const periodStartStr = toDateString(period.start)
  const periodEndStr = toDateString(period.end)

  let row = await db.query.quotaUsage.findFirst({
    where: and(
      eq(quotaUsage.userId, userId),
      eq(quotaUsage.quotaType, type),
      eq(quotaUsage.periodStart, periodStartStr),
      isNull(quotaUsage.deletedAt),
    ),
  })

  if (!row) {
    const [inserted] = await db
      .insert(quotaUsage)
      .values({
        userId,
        quotaType: type,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        limitValue: limit,
        usedValue: 0,
      })
      .returning()
    if (!inserted) {
      throw new ApiError('INTERNAL_ERROR', 'Failed to provision quota row')
    }
    row = inserted
  }

  const used = row.usedValue
  const effectiveLimit = row.limitValue
  if (effectiveLimit !== -1 && used >= effectiveLimit) {
    throw new ApiError('QUOTA_EXCEEDED', `Quota exceeded for ${type}`, {
      details: { used, limit: effectiveLimit, type },
    })
  }

  return {
    used,
    limit: effectiveLimit,
    remaining:
      effectiveLimit === -1
        ? Number.POSITIVE_INFINITY
        : Math.max(0, effectiveLimit - used),
  }
}

/**
 * Atomically increment the user's quota counter for `type` by `by` (default 1).
 *
 * Uses `used_value = used_value + N` in the UPDATE so concurrent requests
 * cannot interleave a stale read/write. Requires the row to exist — call
 * `ensureQuota` first (e.g. at the start of the request) so the period is
 * provisioned.
 */
export async function incrementQuota(
  userId: string,
  type: QuotaType,
  by = 1,
): Promise<void> {
  if (by <= 0) return

  const sub = await getActive(userId)
  if (!sub || !sub.tier) {
    throw new ApiError('SUBSCRIPTION_EXPIRED', 'No active subscription')
  }
  const limit = tierLimitFor(sub.tier, type)
  if (limit === -1) return // unlimited: skip the counter entirely

  const period = getCurrentPeriod(sub)
  const periodStartStr = toDateString(period.start)

  const result = await db
    .update(quotaUsage)
    .set({ usedValue: sql`${quotaUsage.usedValue} + ${by}` })
    .where(
      and(
        eq(quotaUsage.userId, userId),
        eq(quotaUsage.quotaType, type),
        eq(quotaUsage.periodStart, periodStartStr),
        isNull(quotaUsage.deletedAt),
      ),
    )
    .returning({ usedValue: quotaUsage.usedValue, limitValue: quotaUsage.limitValue })

  if (result.length === 0) {
    // Row didn't exist — provision it and increment by `by` in one shot.
    await db.insert(quotaUsage).values({
      userId,
      quotaType: type,
      periodStart: periodStartStr,
      periodEnd: toDateString(period.end),
      limitValue: limit,
      usedValue: by,
    })
    return
  }

  const post = result[0]
  if (post && post.limitValue !== -1 && post.usedValue > post.limitValue) {
    // Soft warning — we already wrote. Caller's responsibility to gate via
    // ensureQuota first. Surface as QUOTA_EXCEEDED so audit/log can flag it.
    throw new ApiError('QUOTA_EXCEEDED', `Quota exceeded for ${type}`, {
      details: { used: post.usedValue, limit: post.limitValue, type },
    })
  }
}

// ── Reset (cron) ─────────────────────────────────────────────────────
/**
 * Close the user's current quota period and open the next one.
 *
 * Invoked by Agent 8's daily cron for every subscription whose
 * `quotaResetAt <= now()`. Idempotent: if the new period already exists this
 * is a no-op. If the user has no active subscription, we leave their
 * historical rows alone (use-it-or-lose-it; trash sweep handles cleanup).
 */
export async function resetForUser(userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.userId, userId),
      isNull(subscriptions.deletedAt),
      inArray(subscriptions.status, ['trial', 'active']),
    ),
  })
  if (!sub || !sub.quotaResetAt) return

  const tier = await db.query.tiers.findFirst({
    where: and(eq(tiers.id, sub.tierId), isNull(tiers.deletedAt)),
  })
  if (!tier) return

  const newStart = sub.quotaResetAt
  const newEnd = addMonths(newStart, 1)

  const types: QuotaType[] = ['pdf_download', 'ai_chat', 'ai_tokens']

  // Seed fresh rows for the new period (skip duplicates via the partial
  // unique index on (user_id, period_start, quota_type)).
  for (const type of types) {
    const limit = tierLimitFor(tier, type)
    if (limit === -1) continue // unlimited tiers don't need a counter row
    const existing = await db.query.quotaUsage.findFirst({
      where: and(
        eq(quotaUsage.userId, userId),
        eq(quotaUsage.quotaType, type),
        eq(quotaUsage.periodStart, toDateString(newStart)),
        isNull(quotaUsage.deletedAt),
      ),
    })
    if (existing) continue
    await db.insert(quotaUsage).values({
      userId,
      quotaType: type,
      periodStart: toDateString(newStart),
      periodEnd: toDateString(newEnd),
      limitValue: limit,
      usedValue: 0,
    })
  }

  // Advance the anchor so subsequent reads land in the new window.
  await db
    .update(subscriptions)
    .set({ quotaResetAt: newEnd, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id))
}

export const quotaService = {
  ensureQuota,
  incrementQuota,
  getCurrentPeriod,
  resetForUser,
}
