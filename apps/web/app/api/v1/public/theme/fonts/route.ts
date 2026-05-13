// GET /api/v1/public/theme/fonts
// PUBLIC endpoint — NO auth, NO permission.  Returns the active font config
// in a shape consumable by the Next.js root layout: one family per role plus
// a de-duped `googleFonts` array for `<link>` injection.
//
// See docs/IDEAS.md §3b.7 (Frontend Integration).  Cache headers below let
// the edge cache absorb most traffic; admin mutations bust the cache by
// pushing a new value (or by deploying a revalidation hook later).

import { ok, withErrorHandling } from '@/lib/server/api'
import * as fontService from '@/lib/server/services/font.service'

export const GET = withErrorHandling(async () => {
  const data = await fontService.getPublicTheme()
  // s-maxage=3600 ≈ 1 hour edge cache, stale-while-revalidate=86400 lets us
  // keep serving stale until a background refresh succeeds.
  return ok(data, undefined, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
})
