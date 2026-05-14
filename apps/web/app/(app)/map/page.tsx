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
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  LayerControls,
  LocationSidePanel,
  parseLayerState,
  type FigureMarkerCollection,
  type LocationSummary,
  type MarkerCollection,
} from '@/components/map'
import { figuresApi, locationsApi } from '@/lib/api/endpoints'

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

/** Shape returned by `/api/v1/figures/map-points` — see `figureService.listMapPoints`. */
export interface FigureMapPointRow {
  figureId: string
  slug: string
  nameFullId: string
  nameFullAr: string
  nameShortId: string | null
  gender: 'male' | 'female'
  categorySlug: string | null
  locationId: string
  locationSlug: string | null
  locationName: string
  longitude: number
  latitude: number
  role: 'primary' | 'death' | 'burial' | 'figure_location'
}

/** Convert figure-map-points to a GeoJSON FeatureCollection for the overlay. */
function figureRowsToCollection(rows: FigureMapPointRow[]): FigureMarkerCollection {
  return {
    type: 'FeatureCollection',
    features: rows
      .filter(
        (r) =>
          Number.isFinite(r.longitude) &&
          Number.isFinite(r.latitude) &&
          // Defensive: drop rows whose coords didn't survive ST_X/ST_Y casts.
          r.longitude >= -180 &&
          r.longitude <= 180 &&
          r.latitude >= -90 &&
          r.latitude <= 90,
      )
      .map((r) => ({
        type: 'Feature',
        id: r.figureId,
        geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
        properties: {
          id: r.figureId,
          slug: r.slug,
          nameFullId: r.nameFullId,
          nameFullAr: r.nameFullAr,
          nameShortId: r.nameShortId,
          role: r.role,
          locationId: r.locationId,
          locationName: r.locationName,
        },
      })),
  }
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

  // Figure overlay — one feature per published tokoh, dropped at their
  // resolved location.  The endpoint returns a plain array (no pagination).
  const { data: figurePoints } = useQuery<FigureMapPointRow[]>({
    queryKey: ['map', 'figure-points'],
    queryFn: async () => {
      const res = await figuresApi.mapPoints()
      return Array.isArray(res) ? (res as FigureMapPointRow[]) : []
    },
    staleTime: 5 * 60_000,
  })

  const collection = useMemo<MarkerCollection>(
    () => rowsToCollection(data ?? []),
    [data],
  )

  const figureCollection = useMemo(
    () => figureRowsToCollection(figurePoints ?? []),
    [figurePoints],
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

  // Tokoh marker click — also select the figure's location so the side panel
  // surfaces the "Tokoh terkait" list and the user has context for where the
  // pin sits.  We do NOT auto-navigate to /figures/[slug] (let the user click
  // the figure name in the side panel for that — keeps the map navigable).
  const handleFigureClick = useCallback(
    (figureId: string) => {
      const fig = (figurePoints ?? []).find((p) => p.figureId === figureId)
      if (!fig) return
      const loc = (data ?? []).find((r) => r.id === fig.locationId)
      if (loc) {
        setSelected({
          id: loc.id,
          slug: loc.slug,
          nameAr: loc.nameAr,
          nameId: loc.nameId,
          modernName: loc.modernName,
          countryCode: loc.countryCode,
        })
        return
      }
      // Fall back to the figure's own location label if the location isn't in
      // the active locations layer (e.g. category filter hid it).
      setSelected({
        id: fig.locationId,
        slug: fig.locationSlug ?? fig.locationId,
        nameAr: '',
        nameId: fig.locationName,
        modernName: null,
        countryCode: null,
      })
    },
    [figurePoints, data],
  )

  // Figures filtered down to whichever location is currently selected — fed
  // into the side panel so it can render the "Tokoh terkait" list without a
  // second HTTP round-trip.  Memoised against the raw point array so the
  // panel doesn't churn on unrelated state changes.
  const figuresAtSelected = useMemo(() => {
    if (!selected) return []
    return (figurePoints ?? []).filter((p) => p.locationId === selected.id)
  }, [figurePoints, selected])


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
              : `${collection.features.length} lokasi · ${figureCollection.features.length} tokoh`}
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
            figureMarkers={figureCollection}
            showFigures={layerState.showFigures}
            selectedId={selected?.id}
            onMarkerClick={handleMarkerClick}
            onFigureClick={handleFigureClick}
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
                  figures={figuresAtSelected}
                  onClose={() => setSelected(null)}
                  compact
                />
              </div>
            </>
          ) : null
        ) : (
          <LocationSidePanel
            location={selected}
            figures={figuresAtSelected}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  )
}
