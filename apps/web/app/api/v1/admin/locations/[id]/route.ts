// PATCH  /api/v1/admin/locations/[id]  — update a location (partial)
// PUT    /api/v1/admin/locations/[id]  — alias for PATCH (legacy callers)
// DELETE /api/v1/admin/locations/[id]  — soft-delete a location
// Permissions: `locations.update` / `locations.delete`.

import { z } from 'zod'

import { noContent, ok, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { locationService } from '@/lib/server/services/location.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case')

const updateSchema = z.object({
  slug: slugSchema.optional(),
  nameAr: z.string().trim().min(1).max(200).optional(),
  nameId: z.string().trim().min(1).max(200).optional(),
  modernName: z.string().trim().max(200).nullable().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  region: z.string().trim().max(64).nullable().optional(),
  countryCode: z
    .string()
    .trim()
    .min(2)
    .max(3)
    .regex(/^[A-Za-z]{2,3}$/)
    .nullable()
    .optional(),
  elevationMeters: z.coerce.number().int().nullable().optional(),
  descriptionAr: z.string().trim().max(8_000).nullable().optional(),
  descriptionId: z.string().trim().max(8_000).nullable().optional(),
  historicalPeriod: z.array(z.string().trim().min(1).max(64)).max(20).nullable().optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'locations.update')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await locationService.update(id, input, userId)
  return ok(row)
})

// Legacy PUT alias — FE client uses PATCH; older callers (e.g.
// location-form.tsx) still send PUT.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'locations.delete')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await locationService.softDelete(id, userId)
  return noContent()
})
