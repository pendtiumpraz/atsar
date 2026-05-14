// POST /api/v1/figures/relation/bulk
//
// Body: { fromSlug: string, toSlugs: string[] (1..20) }
//
// Returns one resolved relation per target slug — same shape as the
// single-figure GET endpoint. Used by the "Hubungan dengan tokoh
// terkenal" widget so the figure detail page can render up to 20
// pre-resolved cards in one round-trip.
//
// Resolution + caching reuse `resolveRelation()` from the GET route, so
// the cache contract (30-day TTL, AI fallback, invalidation) stays in
// one place. Each lookup is awaited serially to keep the AI fallback
// rate friendly — bulk callers should pre-warm the cache so most hits
// stay in `db_graph` and return immediately.

import { z } from 'zod'

import {
  ApiError,
  ok,
  validateBody,
  withErrorHandling,
} from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import {
  resolveFigureBySlug,
  resolveRelation,
} from '../route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  fromSlug: z.string().min(1).max(140),
  toSlugs: z.array(z.string().min(1).max(140)).min(1).max(20),
})

export const POST = withErrorHandling(async (req) => {
  const body = await validateBody(req, bodySchema)

  // De-duplicate and drop self-pair before doing any DB work.
  const uniqueTargets = Array.from(new Set(body.toSlugs)).filter(
    (s) => s !== body.fromSlug,
  )
  if (uniqueTargets.length === 0) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Daftar tokoh tujuan tidak boleh kosong atau sama dengan tokoh asal.',
    )
  }

  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id ?? null

  const fromFig = await resolveFigureBySlug(body.fromSlug)

  const results = []
  for (const slug of uniqueTargets) {
    try {
      const toFig = await resolveFigureBySlug(slug)
      const rel = await resolveRelation(
        {
          fromId: fromFig.id,
          fromSlug: fromFig.slug,
          fromNameFullId: fromFig.nameFullId,
          fromNameFullAr: fromFig.nameFullAr,
          fromNameShortId: fromFig.nameShortId,
          toId: toFig.id,
          toSlug: toFig.slug,
          toNameFullId: toFig.nameFullId,
          toNameFullAr: toFig.nameFullAr,
          toNameShortId: toFig.nameShortId,
        },
        userId,
        {},
      )
      results.push({ slug, relation: rel, error: null })
    } catch (err) {
      // Individual failures don't abort the batch — surface them as
      // per-row errors so the FE can still render successful entries.
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal mengambil hubungan untuk tokoh ini.'
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR'
      results.push({ slug, relation: null, error: { code, message } })
    }
  }

  return ok({ from: body.fromSlug, results })
})
