// POST /api/v1/admin/locations — create a location (admin only).
// Permission: `locations.create`.  See docs/BACKEND.md §5.

import { z } from 'zod'

import { created, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { locationService } from '@/lib/server/services/location.service'

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case')

const createSchema = z.object({
  slug: slugSchema,
  nameAr: z.string().trim().min(1).max(200),
  nameId: z.string().trim().min(1).max(200),
  modernName: z.string().trim().max(200).nullable().optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
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

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'locations.create')
  const input = await validateBody(req, createSchema)
  const row = await locationService.create(input, userId)
  return created(row)
})
