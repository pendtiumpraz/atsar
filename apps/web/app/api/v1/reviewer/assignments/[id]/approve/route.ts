// POST /api/v1/reviewer/assignments/[id]/approve
//   Body (optional): { edits?: { nameFullId?, biographyId?, ... } }
//   → Mark the assignment as approved. Bumps the parent content row to
//     status='published' + publishedAt=now(). When `edits` is supplied,
//     the reviewer's corrections are applied to the content row AND a
//     `content_revisions` row with action='edited_manual' is appended
//     BEFORE the approval revision — the original AI draft (created
//     revision) is preserved untouched.
//
// See docs/IDEAS.md §5c.2 (state machine) and §5c.7 (audit log).

import { z } from 'zod'

import { ApiError, ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { reviewService } from '@/lib/server/services/review.service'

const paramsSchema = z.object({ id: z.string().uuid() })

// Reviewer edits — narrow allow-list of bilingual narrative columns. Slug /
// category / dates stay locked to the admin surface. Each field can be a
// string, null (to clear), or omitted (to leave untouched).
const editsSchema = z
  .object({
    nameFullId: z.string().max(500).nullable().optional(),
    nameFullAr: z.string().max(500).nullable().optional(),
    nameShortId: z.string().max(200).nullable().optional(),
    nameShortAr: z.string().max(200).nullable().optional(),
    summaryId: z.string().max(8000).nullable().optional(),
    summaryAr: z.string().max(8000).nullable().optional(),
    biographyId: z.string().max(40000).nullable().optional(),
    biographyAr: z.string().max(40000).nullable().optional(),
    // Battles
    nameId: z.string().max(500).nullable().optional(),
    nameAr: z.string().max(500).nullable().optional(),
    descriptionId: z.string().max(40000).nullable().optional(),
    descriptionAr: z.string().max(40000).nullable().optional(),
  })
  .strict()

const bodySchema = z
  .object({
    edits: editsSchema.optional(),
  })
  .strict()

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.review')
  const { id } = validateParams(await ctx.params, paramsSchema)

  // Body is optional — when present we validate it; when absent or empty we
  // skip (some clients fire `POST .../approve` with no body at all). We
  // parse the body manually so an empty body doesn't trigger
  // VALIDATION_ERROR from `validateBody`.
  let edits: z.infer<typeof editsSchema> | undefined
  try {
    const text = await req.text()
    if (text.trim().length > 0) {
      const json = JSON.parse(text)
      const result = bodySchema.safeParse(json)
      if (!result.success) {
        throw new ApiError('VALIDATION_ERROR', 'Invalid request body', {
          details: result.error.issues,
        })
      }
      edits = result.data.edits
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    // JSON parse error — surface as 400.
    throw new ApiError('VALIDATION_ERROR', 'Invalid JSON body', { cause: err })
  }

  const updated = await reviewService.approve(id, userId, edits ?? null)
  return ok(updated)
})
