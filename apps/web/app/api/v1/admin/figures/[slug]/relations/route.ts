// POST /api/v1/admin/figures/[slug]/relations
//   → Add a figure_relations row. Inserts BOTH directions (e.g. father+son)
//     via db.batch so the public Hubungan tab and nasab walker see the
//     pair without a follow-up edit. Mirrors seeders/027_relations.ts.
//
// Schema: see packages/db/src/schema/figures.ts → figureRelations.

import { and, eq, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { figureRelationPaths, figureRelations, figures } from '@athar/db/schema'

import { ApiError, created, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { slugSchema } from '@/lib/server/services/figure.schemas'
import { EDGE_INVERSE, type RelationType } from '@/lib/server/services/relation-graph.service'

const paramsSchema = z.object({ slug: slugSchema })

const relationTypeValues = [
  'teacher_of',
  'student_of',
  'father',
  'mother',
  'husband',
  'wife',
  'son',
  'daughter',
  'sibling',
  'companion',
  'descendant',
  'ancestor',
] as const

const createSchema = z.object({
  relatedId: z.string().uuid(),
  relationType: z.enum(relationTypeValues),
  notesAr: z.string().max(4000).nullable().optional(),
  notesId: z.string().max(4000).nullable().optional(),
})

type RouteCtx = { params: Promise<{ slug: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const body = await validateBody(req, createSchema)

  // Resolve source figure.
  const source = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!source) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  if (source.id === body.relatedId) {
    throw new ApiError('VALIDATION_ERROR', 'Tidak bisa membuat relasi ke diri sendiri.', {
      fieldErrors: { relatedId: 'Tidak boleh diri sendiri' },
    })
  }

  // Verify target figure exists + active.
  const target = await db.query.figures.findFirst({
    where: and(eq(figures.id, body.relatedId), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!target) throw new ApiError('NOT_FOUND', `Figure not found: ${body.relatedId}`)

  // Refuse exact duplicate (figureId + relatedId + relationType uniqueness).
  const dup = await db.query.figureRelations.findFirst({
    where: and(
      eq(figureRelations.figureId, source.id),
      eq(figureRelations.relatedId, body.relatedId),
      eq(figureRelations.relationType, body.relationType),
      isNull(figureRelations.deletedAt),
    ),
  })
  if (dup) {
    throw new ApiError('CONFLICT', 'Relasi sudah ada.', {
      fieldErrors: { relationType: 'Relasi ini sudah dicatat' },
    })
  }

  const reverseType = EDGE_INVERSE[body.relationType as RelationType]

  // Forward + reverse via db.batch for a single round-trip.
  const forwardValues = {
    figureId: source.id,
    relatedId: body.relatedId,
    relationType: body.relationType,
    notesAr: body.notesAr ?? null,
    notesId: body.notesId ?? null,
    createdBy: userId,
    updatedBy: userId,
  } satisfies typeof figureRelations.$inferInsert

  const reverseValues = {
    figureId: body.relatedId,
    relatedId: source.id,
    relationType: reverseType,
    notesAr: body.notesAr ?? null,
    notesId: body.notesId ?? null,
    createdBy: userId,
    updatedBy: userId,
  } satisfies typeof figureRelations.$inferInsert

  // Check if the reverse row already exists (e.g. sibling+sibling self-pair
  // when admin double-saved, or admin manually inserted only the other side
  // earlier). Use `onConflictDoNothing` semantics by pre-checking.
  const reverseDup = await db.query.figureRelations.findFirst({
    where: and(
      eq(figureRelations.figureId, body.relatedId),
      eq(figureRelations.relatedId, source.id),
      eq(figureRelations.relationType, reverseType),
      isNull(figureRelations.deletedAt),
    ),
  })

  // Invalidate cached relation paths touching either party so the next
  // /api/v1/figures/relation lookup re-computes.
  const pathInvalidation = db
    .update(figureRelationPaths)
    .set({ deletedAt: new Date(), deletedBy: userId })
    .where(
      and(
        or(
          eq(figureRelationPaths.fromFigureId, source.id),
          eq(figureRelationPaths.toFigureId, source.id),
          eq(figureRelationPaths.fromFigureId, body.relatedId),
          eq(figureRelationPaths.toFigureId, body.relatedId),
        ),
        isNull(figureRelationPaths.deletedAt),
      ),
    )

  // Neon HTTP batch requires a non-empty tuple. We build two shapes
  // depending on whether the reverse already exists; both satisfy the
  // `[query, ...query[]]` signature drizzle expects.
  if (reverseDup) {
    await db.batch([
      db.insert(figureRelations).values(forwardValues),
      pathInvalidation,
    ])
  } else {
    await db.batch([
      db.insert(figureRelations).values(forwardValues),
      db.insert(figureRelations).values(reverseValues),
      pathInvalidation,
    ])
  }

  // Read the forward row back to return to the client.
  const inserted = await db.query.figureRelations.findFirst({
    where: and(
      eq(figureRelations.figureId, source.id),
      eq(figureRelations.relatedId, body.relatedId),
      eq(figureRelations.relationType, body.relationType),
      isNull(figureRelations.deletedAt),
    ),
  })

  await auditLog.write({
    action: 'create',
    resourceType: 'figure_relation',
    resourceId: inserted?.id ?? source.id,
    actorId: userId,
    diff: {
      forward: { figureId: source.id, relatedId: body.relatedId, relationType: body.relationType },
      reverse: reverseDup
        ? { skipped: 'already_exists' }
        : { figureId: body.relatedId, relatedId: source.id, relationType: reverseType },
    },
  })

  return created({
    forward: inserted,
    reverseInserted: !reverseDup,
  })
})
