// `/map` — Athar interactive figure-location map (WIREFRAMES §10).
//
// Architecture deviation from the F5/P5-3 brief:
//   The brief asks for a Server Component that fetches locations on the server
//   and hands them to a client `<MapView />`.  Next.js 15 restricts
//   `dynamic({ ssr: false })` to **Client** Components, and we need that
//   modifier to keep MapLibre's WebGL bundle out of the server pre-render
//   (the library accesses `window` at module load, which crashes SSR).
//   Splitting the page into "server-data + client-orchestrator" would require
//   a 7th source file outside the P5-3 scope, so we collapse the two into a
//   single client component that fetches via TanStack Query with a generous
//   `staleTime`.  The behavioural surface is identical to the brief: initial
//   GeoJSON loads once, gets converted to a `MarkerCollection`, then feeds
//   into `<MapView />` alongside the URL-driven layer / selection state.
//
// Data flow:
//   /api/v1/locations → PublicLocation[] → MarkerCollection (GeoJSON FC)
//   ─→ <MapView /> (cluster + click)  ──→ onMarkerClick(id)
//                                          └─ stored in local React state,
//                                             surfaced to `<LocationSidePanel />`.
//
// Selection state intentionally lives in component state — not the URL —
// because the map's zoom/center are not yet preserved either.  Once we add
// view-state persistence we'll lift both into the search params together.

'use client'

import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import {
  LayerControls,
  LocationSidePanel,
  parseLayerState,
  type LocationSummary,
  type MarkerCollection,
} from '@/components/map'
import { locationsApi } from '@/lib/api/endpoints'

// MapLibre relies on `window`; skip the server pre-render for the canvas.
const MapView = dynamic(
  () => import('@/components/map/map-view').then((m) => m.MapView),
  { ssr: false, loading: () => <MapShellPlaceholder /> },
)

/** Shape returned by `/api/v1/locations` — see `locationService.listPublic`. */
interface PublicLocationRow {
  id: string
  slug: string
  nameAr: string
  nameId: string
  modernName: string | null
  countryCode: string | null
  region: string | null
  coordinates: { type: 'Point'; coordinates: [number, number] } | null
}

/** Convert the API payload to a GeoJSON FeatureCollection consumable by MapLibre. */
function rowsToCollection(rows: PublicLocationRow[]): MarkerCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      // Drop rows with no coordinates — they're useless on a map and would
      // crash the cluster source with `null` geometry.
      .filter((r): r is PublicLocationRow & { coordinates: NonNullable<PublicLocationRow['coordinates']> } =>
        r.coordinates != null,
      )
      .map((r) => ({
        type: 'Feature',
        // GeoJSON `id` field — handy for hover/feature-state but we still
        // mirror it under `properties.id` because MapLibre cluster sources
        // don't preserve top-level ids across feature-property reads.
        id: r.id,
        geometry: r.coordinates,
        properties: {
          id: r.id,
          nameId: r.nameId,
          nameAr: r.nameAr,
          modernName: r.modernName,
          countryCode: r.countryCode,
        },
      })),
  }
}

function MapShellPlaceholder() {
  return (
    <div
      className="flex h-full w-full items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
      role="status"
      aria-label="Memuat peta"
    >
      <span className="text-sm text-[rgb(var(--text-muted))]">Memuat peta…</span>
    </div>
  )
}

export default function MapPage() {
  const searchParams = useSearchParams()
  const layerState = useMemo(
    () => parseLayerState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  // Selection — controlled here so the side panel and the map can both react.
  // We store the full summary (not just the id) so the side panel can render
  // even before the locations query resettles.
  const [selected, setSelected] = useState<LocationSummary | null>(null)

  // Bottom-sheet toggle — driven by viewport width.  We treat anything below
  // 1024px as "mobile" and surface the side panel as a slide-up sheet.
  const [isCompact, setIsCompact] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1023.9px)')
    const onChange = () => setIsCompact(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const { data, isPending, isError } = useQuery<PublicLocationRow[]>({
    queryKey: ['locations', 'public', 'all'],
    queryFn: async () => {
      // The list endpoint paginates everything else but `/locations` returns
      // a plain array (see `locationService.listPublic`).  Cast accordingly.
      const res = await locationsApi.list({})
      // The endpoint either returns the raw array (current behaviour) or a
      // pagination envelope (`{ rows, total, ... }`).  Handle both shapes so
      // we're resilient to BACKEND.md tightening.
      if (Array.isArray(res)) return res as PublicLocationRow[]
      const maybe = res as { rows?: PublicLocationRow[] } | undefined
      return maybe?.rows ?? []
    },
    staleTime: 5 * 60_000,
  })

  const collection = useMemo<MarkerCollection>(
    () => rowsToCollection(data ?? []),
    [data],
  )

  function handleMarkerClick(id: string) {
    const row = (data ?? []).find((r) => r.id === id)
    if (!row) {
      setSelected(null)
      return
    }
    setSelected({
      id: row.id,
      slug: row.slug,
      nameAr: row.nameAr,
      nameId: row.nameId,
      modernName: row.modernName,
      countryCode: row.countryCode,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Peta Tokoh
        </h1>
        <p className="hidden text-sm text-[rgb(var(--text-muted))] sm:block">
          {isPending
            ? 'Memuat lokasi…'
            : isError
              ? 'Gagal memuat lokasi.'
              : `${collection.features.length} lokasi`}
        </p>
      </div>

      <LayerControls />

      <div
        className={
          // Side panel collapses below `lg` and reappears as a bottom sheet
          // overlay when a marker is selected.
          'grid h-[calc(100vh-220px)] min-h-[28rem] grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]'
        }
      >
        <div className="relative h-full min-h-[20rem] overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]">
          <MapView
            markers={collection}
            selectedId={selected?.id}
            onMarkerClick={handleMarkerClick}
            showHijrahRoute={layerState.hijrah}
            className="h-full w-full"
          />
        </div>

        {/* Desktop: side panel always visible; clicking a marker just swaps
            the content.  Mobile: render as a bottom sheet ONLY when a marker
            is selected (and a backdrop so users can dismiss). */}
        {isCompact ? (
          selected ? (
            <>
              <button
                type="button"
                aria-label="Tutup panel"
                onClick={() => setSelected(null)}
                className="fixed inset-0 z-30 cursor-default bg-black/40 focus:outline-none"
              />
              <div className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh]">
                <LocationSidePanel
                  location={selected}
                  onClose={() => setSelected(null)}
                  compact
                />
              </div>
            </>
          ) : null
        ) : (
          <LocationSidePanel
            location={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
