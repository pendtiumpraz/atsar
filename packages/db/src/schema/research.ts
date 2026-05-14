// Research jobs — tracks AI-assisted figure ingest jobs end-to-end.
//
// The `POST /api/v1/admin/figures/ingest` endpoint inserts a `pending` row
// here, fires a QStash webhook, and returns the `id` so the admin UI can
// poll `/api/v1/admin/figures/ingest-jobs/[id]` for completion.
//
// The QStash worker (`/api/jobs/research`, dispatch type `figure_ingest`)
// updates the row to `running` while it works, then writes the resulting
// figure id back to `result_figure_id` on success or `error_message` on
// failure. See docs/IDEAS.md (Tambah Tokoh via AI) + docs/BACKEND.md §8.2.
//
// `payload` is the original request body (figure name, hints, category,
// gender). Kept as `jsonb` so the schema can evolve without a migration
// every time we add an optional hint.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import { researchJobStatusEnum, researchJobTypeEnum } from './enums.js'

// ─── research_jobs ───────────────────────────────────────────────────
export const researchJobs = pgTable(
  'research_jobs',
  {
    ...baseColumns,
    type: researchJobTypeEnum('type').notNull(),
    status: researchJobStatusEnum('status').notNull().default('pending'),
    /** Arbitrary input payload (figure name + hints + category + gender). */
    payload: jsonb('payload').notNull(),
    /** QStash message id (best-effort — not unique because retries reuse the same row). */
    messageId: text('message_id'),
    /** On success: id of the created `figures` row. */
    resultFigureId: uuid('result_figure_id'),
    /** On failure: short machine-readable code (e.g. `no_sources`, `provider_not_configured`). */
    errorCode: text('error_code'),
    /** On failure: human-readable message (admin sees this in the UI). */
    errorMessage: text('error_message'),
    /** Timestamp the worker picked the row up. */
    startedAt: timestamp('started_at', { withTimezone: true }),
    /** Timestamp the worker either succeeded or gave up. */
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('research_jobs_status_idx')
      .on(t.status)
      .where(sql`${t.deletedAt} IS NULL`),
    index('research_jobs_created_by_idx')
      .on(t.createdBy)
      .where(sql`${t.deletedAt} IS NULL`),
    index('research_jobs_type_status_idx')
      .on(t.type, t.status)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)
