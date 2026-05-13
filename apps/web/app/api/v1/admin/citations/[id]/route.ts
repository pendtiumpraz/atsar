// DELETE /api/v1/admin/citations/[id]
//   → Soft-delete a citation. Admin-only because dropping a citation can
//     break the audit chain for any content that referenced it; reviewers
//     should create *new* citations, not remove old ones.
//
// See docs/IDEAS.md §5c.3.

import { z } from 'zod'

import { noContent, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { citationService } from '@/lib/server/services/citation.service'

const paramsSchema = z.object({ id: z.string().uuid() })

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.delete')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await citationService.softDelete(id, userId)
  return noContent()
})
