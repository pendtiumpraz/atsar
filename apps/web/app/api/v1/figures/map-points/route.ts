// GET /api/v1/figures/map-points — figure overlay layer for `/map`.
//
// One row per PUBLISHED figure that resolves to at least one location via
// the preference cascade primary → death → burial → first `figure_locations`
// row.  Coordinates are projected to plain `longitude`/`latitude` numbers
// (no GeoJSON wrapping) so the client can drop them straight into a
// MapLibre GeoJSON source without re-shaping.
//
// Auth: same as `/api/v1/locations` — no permission check.  We DO read the
// session so the content-access service can scope results: anonymous /
// free-tier users only see figures their tier covers (nabi +
// shalih_pre_rasul + curated), staff (admin/reviewer) bypass.
//
// See `figureService.listMapPoints` for the SQL.

import { ok, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { figureService } from '@/lib/server/services/figure.service'

export const GET = withErrorHandling(async (req) => {
  // Optional auth — null for anonymous; the service applies free-tier
  // content scope in that case.
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id ?? null

  const rows = await figureService.listMapPoints(userId)
  return ok(rows)
})
