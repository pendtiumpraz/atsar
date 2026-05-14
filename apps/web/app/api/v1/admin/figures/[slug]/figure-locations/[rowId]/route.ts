// DELETE /api/v1/admin/figures/[slug]/figure-locations/[rowId]
//   → Soft-delete a figure↔location M2M row.

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { figureLocations, figures } from '@athar/db/schema'

import { ApiError, noContent, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { slugSchema } from '@/lib/server/services/figure.schemas'

const paramsSchema = z.object({
  slug: slugSchema,
  rowId: z.string().uuid(),
})

type RouteCtx = { params: Promise<{ slug: string; rowId: string }> }

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug, rowId } = validateParams(await ctx.params, paramsSchema)

  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!figure) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const row = await db.query.figureLocations.findFirst({
    where: and(
      eq(figureLocations.id, rowId),
      eq(figureLocations.figureId, figure.id),
      isNull(figureLocations.deletedAt),
    ),
  })
  if (!row) throw new ApiError('NOT_FOUND', `figure_locations row not found: ${rowId}`)

  await db
    .update(figureLocations)
    .set({ deletedAt: new Date(), deletedBy: userId, updatedBy: userId })
    .where(eq(figureLocations.id, rowId))

  await auditLog.write({
    action: 'soft_delete',
    resourceType: 'figure_location',
    resourceId: rowId,
    actorId: userId,
    diff: { figureId: figure.id, locationId: row.locationId, role: row.role },
  })

  return noContent()
})
