// GET  /api/v1/admin/fonts  — list fonts (paginated, filterable)
// POST /api/v1/admin/fonts  — create a new font entry
// Permissions: GET → `fonts.view`, POST → `fonts.manage`.
// See docs/IDEAS.md §3b (Font Management).

import { z } from 'zod'

import {
  created,
  paginatedOk,
  validateBody,
  validateQuery,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as fontService from '@/lib/server/services/font.service'
import { FONT_SCRIPTS, FONT_SOURCES } from '@/lib/server/services/font.service'

const listQuerySchema = z.object({
  script: z.enum(FONT_SCRIPTS).optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
})

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  family: z.string().trim().min(1).max(120),
  script: z.enum(FONT_SCRIPTS),
  source: z.enum(FONT_SOURCES),
  googleFamilyName: z.string().trim().min(1).max(120).optional().nullable(),
  customUrl: z.string().trim().url().max(500).optional().nullable(),
  filePaths: z.record(z.string().min(1)).optional().nullable(),
  weights: z.array(z.number().int().min(100).max(900)).max(20).optional().nullable(),
  styles: z.array(z.string().trim().min(1).max(32)).max(20).optional().nullable(),
  unicodeRange: z.string().trim().max(2000).optional().nullable(),
  previewTextAr: z.string().trim().max(500).optional().nullable(),
  previewTextId: z.string().trim().max(500).optional().nullable(),
  license: z.string().trim().max(120).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'fonts.view')
  const url = new URL(req.url)
  const q = validateQuery(url.searchParams, listQuerySchema)
  const { rows, total, page, perPage } = await fontService.list(q)
  return paginatedOk(rows, { page, perPage, total })
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'fonts.manage')
  const input = await validateBody(req, createSchema)
  const row = await fontService.create(input, userId)
  return created(row)
})
