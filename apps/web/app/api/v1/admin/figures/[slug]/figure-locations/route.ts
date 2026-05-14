// POST /api/v1/admin/figures/[slug]/figure-locations
//   → Attach a location to this figure with a role (M2M row in `figure_locations`).
//
// See packages/db/src/schema/figures.ts — figureLocationRoleEnum:
//   birthplace / residence / dakwah / martyr / burial.

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { figureLocations, figures, locations } from '@athar/db/schema'

import { ApiError, created, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { slugSchema } from '@/lib/server/services/figure.schemas'

const paramsSchema = z.object({ slug: slugSchema })

const roleValues = ['birthplace', 'residence', 'dakwah', 'martyr', 'burial'] as const

const createSchema = z.object({
  locationId: z.string().uuid(),
  role: z.enum(roleValues),
  periodStartAh: z.number().int().min(-200).max(1500).nullable().optional(),
  periodEndAh: z.number().int().min(-200).max(1500).nullable().optional(),
  notesAr: z.string().max(4000).nullable().optional(),
  notesId: z.string().max(4000).nullable().optional(),
})

type RouteCtx = { params: Promise<{ slug: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const body = await validateBody(req, createSchema)

  // Resolve figure.
  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!figure) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  // Verify location exists + active.
  const loc = await db.query.locations.findFirst({
    where: and(eq(locations.id, body.locationId), isNull(locations.deletedAt)),
    columns: { id: true },
  })
  if (!loc) throw new ApiError('NOT_FOUND', `Location not found: ${body.locationId}`)

  const [inserted] = await db
    .insert(figureLocations)
    .values({
      figureId: figure.id,
      locationId: body.locationId,
      role: body.role,
      periodStartAh: body.periodStartAh ?? null,
      periodEndAh: body.periodEndAh ?? null,
      notesAr: body.notesAr ?? null,
      notesId: body.notesId ?? null,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Gagal menyimpan lokasi tokoh.')

  await auditLog.write({
    action: 'create',
    resourceType: 'figure_location',
    resourceId: inserted.id,
    actorId: userId,
    diff: { after: inserted },
  })

  return created(inserted)
})
