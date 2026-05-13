// POST /api/v1/reviewer/assignments/[id]/request-edit
//   Body: { instruction: string }
//   → Close the assignment with decision='request_edit'. Bumps the parent
//     content to status='needs_edit' and inserts a content_revisions row
//     with action='edited_ai' carrying the reviewer's instruction. An
//     async QStash job will pick up the instruction and have AI rewrite
//     the content (job hookup is TODO — see review.service.ts).
//
// See docs/IDEAS.md §5c.5 (AI-Assisted Edit).

import { z } from 'zod'

import { ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { reviewService } from '@/lib/server/services/review.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  instruction: z.string().trim().min(1, 'instruction is required').max(8000),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.review')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const { instruction } = await validateBody(req, bodySchema)
  const updated = await reviewService.requestEdit(id, userId, instruction)
  return ok(updated)
})
