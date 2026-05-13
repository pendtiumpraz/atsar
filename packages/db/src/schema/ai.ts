// AI providers, models, usage. See DATABASE.md §8.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  numeric,
  date,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import {
  aiSdkAdapterEnum,
  aiRoleEnum,
  aiRequestTypeEnum,
  aiUsageStatusEnum,
} from './enums.js'
import { users } from './auth.js'

// ─── ai_providers ──────────────────────────────────────────────────
export const aiProviders = pgTable(
  'ai_providers',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    sdkAdapter: aiSdkAdapterEnum('sdk_adapter').notNull(),
    baseUrl: text('base_url'),
    apiKeyEncrypted: text('api_key_encrypted'), // encrypted with AI_MASTER_KEY (AES-256-GCM)
    isActive: boolean('is_active').notNull().default(false),
    notes: text('notes'),
  },
  (t) => [
    uniqueIndex('ai_providers_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── ai_models ─────────────────────────────────────────────────────
export const aiModels = pgTable(
  'ai_models',
  {
    ...baseColumns,
    providerId: uuid('provider_id')
      .notNull()
      .references(() => aiProviders.id, { onDelete: 'cascade' }),
    modelId: text('model_id').notNull(),
    displayName: text('display_name'),
    capabilities: text('capabilities').array(), // ['chat','agent','doc_analyzer','embedding','vision']
    contextWindow: integer('context_window'),
    maxOutputTokens: integer('max_output_tokens'),
    supportsStreaming: boolean('supports_streaming').notNull().default(true),
    supportsTools: boolean('supports_tools').notNull().default(false),
    supportsVision: boolean('supports_vision').notNull().default(false),
    inputPricePer1m: numeric('input_price_per_1m', { precision: 10, scale: 4 }),
    outputPricePer1m: numeric('output_price_per_1m', { precision: 10, scale: 4 }),
    cachedPricePer1m: numeric('cached_price_per_1m', { precision: 10, scale: 4 }),
    releaseDate: date('release_date'),
    deprecatedAt: date('deprecated_at'),
    isActive: boolean('is_active').notNull().default(false),
    notes: text('notes'),
  },
  (t) => [
    uniqueIndex('ai_models_provider_modelid_idx')
      .on(t.providerId, t.modelId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('ai_models_active_idx').on(t.isActive).where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── ai_role_assignments ───────────────────────────────────────────
export const aiRoleAssignments = pgTable(
  'ai_role_assignments',
  {
    ...baseColumns,
    role: aiRoleEnum('role').notNull(),
    modelId: uuid('model_id')
      .notNull()
      .references(() => aiModels.id),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    activatedBy: uuid('activated_by').references(() => users.id),
  },
  (t) => [
    uniqueIndex('ai_role_assignments_role_active_idx')
      .on(t.role)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── ai_credit_packages ────────────────────────────────────────────
export const aiCreditPackages = pgTable(
  'ai_credit_packages',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    creditsPer1kInputTokens: numeric('credits_per_1k_input_tokens', {
      precision: 12,
      scale: 6,
    }),
    creditsPer1kOutputTokens: numeric('credits_per_1k_output_tokens', {
      precision: 12,
      scale: 6,
    }),
    creditsPerImageGenerated: numeric('credits_per_image_generated', {
      precision: 12,
      scale: 6,
    }),
  },
  (t) => [
    uniqueIndex('ai_credit_packages_slug_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── ai_usage_logs ─────────────────────────────────────────────────
export const aiUsageLogs = pgTable(
  'ai_usage_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    sessionId: uuid('session_id'),
    role: aiRoleEnum('role'),
    providerId: uuid('provider_id').references(() => aiProviders.id),
    modelId: uuid('model_id').references(() => aiModels.id),
    requestType: aiRequestTypeEnum('request_type'),
    contextSummary: text('context_summary'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cachedTokens: integer('cached_tokens'),
    creditsUsed: numeric('credits_used', { precision: 12, scale: 6 }),
    durationMs: integer('duration_ms'),
    status: aiUsageStatusEnum('status'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_usage_logs_user_created_idx').on(t.userId, t.createdAt),
    index('ai_usage_logs_model_created_idx').on(t.modelId, t.createdAt),
    index('ai_usage_logs_role_created_idx').on(t.role, t.createdAt),
  ],
)
