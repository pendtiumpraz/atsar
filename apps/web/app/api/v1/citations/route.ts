// GET  /api/v1/citations?contentType=figure&contentId=<uuid>
//   → list active citations for a single content row (oldest first)
// POST /api/v1/citations
//   → create a new citation (requires `figures.review` — citations are part
//     of the reviewer / extraction workflow, not user-editable content)
//
// See docs/IDEAS.md §5c.3 (Mandatory Citation) + DATABASE.md §7.

import { z } from 'zod'

import { ok, paginatedOk, validateBody, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { citationService } from '@/lib/server/services/citation.service'

const contentTypeValues = ['figure', 'battle', 'location'] as const
const sourceLangValues = ['ar', 'id', 'en'] as const

const listQuerySchema = z.object({
  contentType: z.enum(contentTypeValues),
  contentId: z.string().uuid(),
})

const createSchema = z.object({
  contentType: z.enum(contentTypeValues),
  contentId: z.string().uuid(),
  fieldPath: z.string().trim().min(1).max(200).optional().nullable(),
  sourceUrl: z.string().url().max(2000),
  sourceExcerptAr: z.string().max(8000).optional().nullable(),
  sourceExcerptId: z.string().max(8000).optional().nullable(),
  sourceLang: z.enum(sourceLangValues).optional().nullable(),
  modelUsed: z.string().max(120).optional().nullable(),
  confidenceScore: z
    .union([z.string().regex(/^\d(\.\d{1,2})?$/), z.number().min(0).max(1)])
    .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v))
    .optional()
    .nullable(),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'figures.view')
  const url = new URL(req.url)
  const { contentType, contentId } = validateQuery(url.searchParams, listQuerySchema)
  const rows = await citationService.listForContent(contentType, contentId)
  // Citations for a single content row are bounded (typically <20), so we
  // skip true pagination but still return the standard list envelope.
  return paginatedOk(rows, { page: 1, perPage: rows.length || 1, total: rows.length })
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'figures.review')
  const body = await validateBody(req, createSchema)
  const created = await citationService.create(body, userId)
  return ok(created, undefined, { status: 201 })
})
