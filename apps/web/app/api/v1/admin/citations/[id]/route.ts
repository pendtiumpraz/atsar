// PATCH  /api/v1/admin/citations/[id]
//   → Update a citation's mutable fields (excerpt text, source URL, etc.).
//     Admin-only — reviewers should add fresh citations rather than mutate
//     existing ones, but admin needs an escape hatch for typo fixes.
//
// PUT    /api/v1/admin/citations/[id]
//   → Alias for PATCH (legacy callers).
//
// DELETE /api/v1/admin/citations/[id]
//   → Soft-delete a citation. Admin-only because dropping a citation can
//     break the audit chain for any content that referenced it; reviewers
//     should create *new* citations, not remove old ones.
//
// See docs/IDEAS.md §5c.3.

import { z } from 'zod'

import { noContent, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { citationService } from '@/lib/server/services/citation.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateSchema = z.object({
  fieldPath: z.string().trim().max(200).nullable().optional(),
  sourceUrl: z.string().trim().url().max(2000).optional(),
  sourceExcerptAr: z.string().trim().max(8_000).nullable().optional(),
  sourceExcerptId: z.string().trim().max(8_000).nullable().optional(),
  sourceLang: z.enum(['ar', 'id', 'en']).nullable().optional(),
  modelUsed: z.string().trim().max(120).nullable().optional(),
  confidenceScore: z
    .union([z.string().trim().max(8), z.number()])
    .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v))
    .nullable()
    .optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await citationService.update(id, input, userId)
  return ok(row)
})

// Legacy PUT alias — FE client uses PATCH.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.delete')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await citationService.softDelete(id, userId)
  return noContent()
})
