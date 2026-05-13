// Server-side accessor for the active public-theme font manifest.
//
// We deliberately call `font.service.getPublicTheme()` directly rather than
// looping back through `GET /api/v1/public/theme/fonts` via `fetch()`.  On
// Vercel the same-region HTTP overhead (~20–50ms cold) is wasted work — the
// service is in-process.
//
// FRONTEND.md §9 references `fetch(...)` for illustrative purposes only; the
// implementation here is the production pattern.
//
// A thin `unstable_cache` wrapper memoises the call for 1h (tag: 'fonts') so
// SSR navigations don't hit the DB on every request.  Admin mutations that
// change font assignments should `revalidateTag('fonts')` to bust this cache.

import { unstable_cache } from 'next/cache'

import { getPublicTheme } from '@/lib/server/services/font.service'

const getCachedPublicTheme = unstable_cache(
  async () => getPublicTheme(),
  ['public-theme-fonts'],
  { revalidate: 3600, tags: ['fonts'] },
)

export const getActiveThemeFonts = async () => getCachedPublicTheme()

export type ThemeFonts = Awaited<ReturnType<typeof getPublicTheme>>
