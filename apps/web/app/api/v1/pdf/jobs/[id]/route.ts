// GET /api/v1/pdf/jobs/:id  → fetch a single PDF job's status.
//
// Access control:
//   - The job's owner can read it (matched against the session user id).
//   - Anyone with `pdf.export_custom` (admin/reviewer tier) can also read
//     any job — useful for support ("why didn't my PDF generate?").
//
// Returns the full `pdf_jobs` row including `status`, `fileUrl` (set once
// the worker is done), `errorMessage`, and `generatedAt`.

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { pdfJobs } from '@athar/db/schema'

import { ApiError, ok, validateParams, withErrorHandling } from '@/lib/server/api'
import { getEffectivePermissions, requireAuth } from '@/lib/server/rbac'

type RouteCtx = { params: Promise<{ id: string }> }

const paramsSchema = z.object({ id: z.string().uuid() })

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requireAuth(req)
  const { id } = validateParams(await ctx.params, paramsSchema)

  const row = await db.query.pdfJobs.findFirst({
    where: and(eq(pdfJobs.id, id), isNull(pdfJobs.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', 'PDF job not found')

  if (row.userId !== userId) {
    // Owner mismatch — only admins (pdf.export_custom) can peek at
    // other users' jobs. Anyone else gets a flat 403.
    const perms = await getEffectivePermissions(userId)
    if (!perms.has('pdf.export_custom')) {
      throw new ApiError('PERMISSION_DENIED', 'You can only view your own PDF jobs')
    }
  }

  return ok(row)
})
