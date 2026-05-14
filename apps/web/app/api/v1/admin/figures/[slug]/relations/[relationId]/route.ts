// DELETE /api/v1/admin/figures/[slug]/relations/[relationId]
//   → Soft-delete a figure_relations row. Also soft-deletes the REVERSE row
//     (so the pair stays consistent) and invalidates cached relation paths.

import { and, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { figureRelationPaths, figureRelations, figures } from '@athar/db/schema'

import { ApiError, noContent, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { slugSchema } from '@/lib/server/services/figure.schemas'
import { EDGE_INVERSE, type RelationType } from '@/lib/server/services/relation-graph.service'

const paramsSchema = z.object({
  slug: slugSchema,
  relationId: z.string().uuid(),
})

type RouteCtx = { params: Promise<{ slug: string; relationId: string }> }

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug, relationId } = validateParams(await ctx.params, paramsSchema)

  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!figure) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const row = await db.query.figureRelations.findFirst({
    where: and(
      eq(figureRelations.id, relationId),
      eq(figureRelations.figureId, figure.id),
      isNull(figureRelations.deletedAt),
    ),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Relation not found: ${relationId}`)

  const reverseType = EDGE_INVERSE[row.relationType as RelationType]
  const now = new Date()

  // Soft-delete forward + reverse + invalidate cached paths in a single batch.
  await db.batch([
    db
      .update(figureRelations)
      .set({ deletedAt: now, deletedBy: userId, updatedBy: userId })
      .where(eq(figureRelations.id, relationId)),
    db
      .update(figureRelations)
      .set({ deletedAt: now, deletedBy: userId, updatedBy: userId })
      .where(
        and(
          eq(figureRelations.figureId, row.relatedId),
          eq(figureRelations.relatedId, figure.id),
          eq(figureRelations.relationType, reverseType),
          isNull(figureRelations.deletedAt),
        ),
      ),
    db
      .update(figureRelationPaths)
      .set({ deletedAt: now, deletedBy: userId })
      .where(
        and(
          or(
            eq(figureRelationPaths.fromFigureId, figure.id),
            eq(figureRelationPaths.toFigureId, figure.id),
            eq(figureRelationPaths.fromFigureId, row.relatedId),
            eq(figureRelationPaths.toFigureId, row.relatedId),
          ),
          isNull(figureRelationPaths.deletedAt),
        ),
      ),
  ])

  await auditLog.write({
    action: 'soft_delete',
    resourceType: 'figure_relation',
    resourceId: relationId,
    actorId: userId,
    diff: {
      figureId: figure.id,
      relatedId: row.relatedId,
      relationType: row.relationType,
      reverseType,
    },
  })

  return noContent()
})
