// Billing & subscription schema. See DATABASE.md §3.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import {
  billingCycleEnum,
  subscriptionStatusEnum,
  paymentStatusEnum,
  paymentMethodEnum,
  quotaTypeEnum,
} from './enums.js'
import { users } from './auth.js'

// ─── tiers ─────────────────────────────────────────────────────────
export const tiers = pgTable(
  'tiers',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(), // 'free' | 'sampler' | 'basic' | 'pro' | 'premium'
    nameId: text('name_id').notNull(),
    priceMonthlyIdr: integer('price_monthly_idr').notNull().default(0),
    priceYearlyIdr: integer('price_yearly_idr').notNull().default(0),
    downloadQuota: integer('download_quota').notNull().default(0), // -1 = unlimited
    aiChatQuota: integer('ai_chat_quota').notNull().default(0),
    contentScope: jsonb('content_scope').$type<{
      categories: string[]
      curatedFigureIds?: string[] // for Free/Sampler tier curation
      curatedCount?: { sahabat?: number; tabiin?: number; tabiut_tabiin?: number }
    }>(),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [uniqueIndex('tiers_slug_active_idx').on(t.slug).where(sql`${t.deletedAt} IS NULL`)],
)

// ─── subscriptions ─────────────────────────────────────────────────
export const subscriptions = pgTable(
  'subscriptions',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tierId: uuid('tier_id')
      .notNull()
      .references(() => tiers.id),
    status: subscriptionStatusEnum('status').notNull(),
    billingCycle: billingCycleEnum('billing_cycle'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    trialUntil: timestamp('trial_until', { withTimezone: true }),
    quotaResetAt: timestamp('quota_reset_at', { withTimezone: true }),
    autoRenew: boolean('auto_renew').notNull().default(false),
    activatedBy: uuid('activated_by').references(() => users.id),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    notes: text('notes'),
  },
  (t) => [
    index('subscriptions_user_idx').on(t.userId).where(sql`${t.deletedAt} IS NULL`),
    index('subscriptions_status_idx').on(t.status).where(sql`${t.deletedAt} IS NULL`),
    index('subscriptions_expires_idx').on(t.expiresAt).where(sql`${t.deletedAt} IS NULL`),
    index('subscriptions_quota_reset_idx')
      .on(t.quotaResetAt)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── payments ──────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
    amountIdr: integer('amount_idr').notNull(),
    method: paymentMethodEnum('method').notNull(),
    reference: text('reference'),
    proofUrl: text('proof_url'),
    status: paymentStatusEnum('status').notNull().default('pending'),
    confirmedBy: uuid('confirmed_by').references(() => users.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  },
  (t) => [
    index('payments_user_idx').on(t.userId).where(sql`${t.deletedAt} IS NULL`),
    index('payments_status_idx').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── quota_usage ───────────────────────────────────────────────────
export const quotaUsage = pgTable(
  'quota_usage',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    quotaType: quotaTypeEnum('quota_type').notNull(),
    limitValue: integer('limit_value').notNull(),
    usedValue: integer('used_value').notNull().default(0),
  },
  (t) => [
    uniqueIndex('quota_usage_user_period_type_idx')
      .on(t.userId, t.periodStart, t.quotaType)
      .where(sql`${t.deletedAt} IS NULL`),
    index('quota_usage_user_idx').on(t.userId),
  ],
)
