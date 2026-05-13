// GET /api/v1/locations — public list for the map.
// Returns every active location with `coordinates` projected to GeoJSON
// Point shape: `{ type: 'Point', coordinates: [lng, lat] }`.
//
// Public endpoint — no auth required.  Filters: q (free text), region,
// countryCode.  Map clients typically load the full layer once and filter
// client-side, so no pagination.

import { z } from 'zod'

import { ok, validateQuery, withErrorHandling } from '@/lib/server/api'
import { locationService } from '@/lib/server/services/location.service'

const querySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  region: z.string().trim().min(1).max(64).optional(),
  countryCode: z
    .string()
    .trim()
    .min(2)
    .max(3)
    .regex(/^[A-Za-z]{2,3}$/)
    .optional(),
})

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url)
  const query = validateQuery(url.searchParams, querySchema)
  const rows = await locationService.listPublic(query)
  return ok(rows)
})
