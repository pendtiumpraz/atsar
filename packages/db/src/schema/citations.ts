// Citations, whitelist, content_revisions, review_assignments, embeddings.
// See DATABASE.md §7.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  boolean,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import {
  revisionActionEnum,
  reviewStatusEnum,
  reviewDecisionEnum,
  actorRoleEnum,
  sourceLangEnum,
} from './enums.js'
import { users } from './auth.js'

// ─── whitelist_domains ─────────────────────────────────────────────
export const whitelistDomains = pgTable(
  'whitelist_domains',
  {
    ...baseColumns,
    domain: text('domain').notNull().unique(),
    displayName: text('display_name'),
    primaryLanguage: sourceLangEnum('primary_language'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    priority: integer('priority').notNull().default(0),
    crawlRatePerMinute: integer('crawl_rate_per_minute').notNull().default(30),
  },
  (t) => [
    uniqueIndex('whitelist_domains_domain_active_idx')
      .on(t.domain)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── citations ─────────────────────────────────────────────────────
export const citations = pgTable(
  'citations',
  {
    ...baseColumns,
    contentType: text('content_type').notNull(), // 'figure' | 'battle' | 'location'
    contentId: uuid('content_id').notNull(),
    fieldPath: text('field_path'),
    sourceUrl: text('source_url').notNull(),
    sourceDomain: text('source_domain'),
    sourceExcerptAr: text('source_excerpt_ar'),
    sourceExcerptId: text('source_excerpt_id'),
    sourceLang: sourceLangEnum('source_lang'),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    modelUsed: text('model_used'),
    confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }),
  },
  (t) => [
    index('citations_content_idx')
      .on(t.contentType, t.contentId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('citations_domain_idx').on(t.sourceDomain),
  ],
)

// ─── content_citation_embeddings (pgvector) ────────────────────────
export const contentCitationEmbeddings = pgTable(
  'content_citation_embeddings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    citationId: uuid('citation_id')
      .notNull()
      .references(() => citations.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', { dimensions: 1536 }),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('cce_citation_idx').on(t.citationId)],
)

// ─── content_revisions (immutable log) ─────────────────────────────
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentType: text('content_type').notNull(),
    contentId: uuid('content_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    diff: jsonb('diff'),
    action: revisionActionEnum('action').notNull(),
    actorId: uuid('actor_id'),
    actorRole: actorRoleEnum('actor_role'),
    notes: text('notes'),
    aiInstruction: text('ai_instruction'),
    aiModelUsed: text('ai_model_used'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('content_revisions_unique_idx').on(
      t.contentType,
      t.contentId,
      t.revisionNumber,
    ),
    index('content_revisions_content_idx').on(t.contentType, t.contentId),
    index('content_revisions_actor_idx').on(t.actorId),
  ],
)

// ─── review_assignments ────────────────────────────────────────────
export const reviewAssignments = pgTable(
  'review_assignments',
  {
    ...baseColumns,
    contentType: text('content_type').notNull(),
    contentId: uuid('content_id').notNull(),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    status: reviewStatusEnum('status').notNull().default('pending'),
    decision: reviewDecisionEnum('decision'),
    decisionAt: timestamp('decision_at', { withTimezone: true }),
    decisionNotes: text('decision_notes'),
  },
  (t) => [
    index('review_assignments_reviewer_idx')
      .on(t.reviewerId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('review_assignments_content_idx')
      .on(t.contentType, t.contentId)
      .where(sql`${t.deletedAt} IS NULL`),
    index('review_assignments_status_idx')
      .on(t.status)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)
