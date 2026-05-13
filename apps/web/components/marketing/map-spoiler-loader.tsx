// Client-side loader for the MapLibre canvas.
//
// Next.js 15 forbids `dynamic({ ssr: false })` inside Server Components. The
// parent (`map-spoiler.tsx`) is a Server Component so we put the lazy import
// here, in a thin Client Component whose only job is to wire next/dynamic.
//
// MapLibre touches `window` synchronously at module load, so `ssr: false` is
// required; otherwise we get "ReferenceError: window is not defined" during
// the server render pass.

'use client'

import dynamic from 'next/dynamic'

const InteractiveMap = dynamic(
  () => import('./map-spoiler-interactive').then((m) => m.MapSpoilerInteractive),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] w-full animate-pulse rounded-lg bg-[rgb(var(--bg-elevated))] sm:h-[560px]" />
    ),
  },
)

export function MapSpoilerLoader() {
  return <InteractiveMap />
}
