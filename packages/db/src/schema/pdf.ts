// PDF export jobs & templates. See DATABASE.md §10.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import {
  pdfJobTypeEnum,
  pdfJobStatusEnum,
  pdfLanguageModeEnum,
  pdfPaperSizeEnum,
  pdfOrientationEnum,
} from './enums.js'
import { users } from './auth.js'

// ─── pdf_templates ─────────────────────────────────────────────────
export const pdfTemplates = pgTable(
  'pdf_templates',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(),
    nameId: text('name_id').notNull(),
    nameAr: text('name_ar'),
    previewImageUrl: text('preview_image_url'),
    templatePath: text('template_path').notNull(),
    supportsOrientation: text('supports_orientation').array(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    uniqueIndex('pdf_templates_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── pdf_jobs ──────────────────────────────────────────────────────
export const pdfJobs = pgTable(
  'pdf_jobs',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    jobType: pdfJobTypeEnum('job_type').notNull(),
    figureIds: uuid('figure_ids').array(),
    templateSlug: text('template_slug'),
    paperSize: pdfPaperSizeEnum('paper_size').notNull().default('a4'),
    orientation: pdfOrientationEnum('orientation').notNull().default('portrait'),
    languageMode: pdfLanguageModeEnum('language_mode').notNull().default('both'),
    titleAr: text('title_ar'),
    titleId: text('title_id'),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    includeIllustrations: boolean('include_illustrations').notNull().default(true),
    includeMaps: boolean('include_maps').notNull().default(true),
    includeTimeline: boolean('include_timeline').notNull().default(true),
    status: pdfJobStatusEnum('status').notNull().default('queued'),
    fileUrl: text('file_url'),
    fileSizeBytes: integer('file_size_bytes'),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    errorMessage: text('error_message'),
  },
  (t) => [
    index('pdf_jobs_user_created_idx').on(t.userId, t.createdAt),
    index('pdf_jobs_status_idx').on(t.status).where(sql`${t.deletedAt} IS NULL`),
  ],
)
