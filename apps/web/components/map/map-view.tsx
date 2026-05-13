// `<MapView />` — thin client wrapper around `react-map-gl/maplibre`.
//
// Renders a MapLibre canvas with:
//   - A theme-aware CARTO raster basemap (light / dark) that swaps when the
//     `<html data-theme>` attribute changes.  We watch the dataset via a
//     `MutationObserver` so the map reacts without a re-mount.
//   - A clustered GeoJSON source for figure-density markers (built-in MapLibre
//     `cluster: true` with radius 50 / maxZoom 14).
//   - Three layers driven by that source:
//       1. `clusters`     — circle, color stepped by point_count.
//       2. `cluster-count` — text label centered on each cluster circle.
//       3. `unclustered`  — primary-emerald circle for individual locations.
//       4. `selected-ring` — outer ring around the currently-selected feature.
//   - An optional Hijrah route (Mekkah → Madinah) as a dashed LineString — the
//     parent toggles its visibility via the `showHijrahRoute` prop.
//
// Selection is fully controlled: the parent passes `selectedId`, we filter the
// `selected-ring` layer by it, and we surface `onMarkerClick(id)` whenever the
// user taps a non-cluster point.  Cluster taps zoom in via `getClusterExpansionZoom`.
//
// We intentionally do NOT subscribe to global app state here — the page wires
// the data, selection, and toggles together.  Keeping this component "dumb"
// means it stays cheap to test and re-mount.
//
// MapLibre touches `window` synchronously at module load, so callers should
// lazy-load this component via `next/dynamic({ ssr: false })`.  The page in
// `app/(app)/map/page.tsx` does exactly that.

'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import {
  type CircleLayerSpecification,
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type LineLayerSpecification,
  type StyleSpecification,
  type SymbolLayerSpecification,
} from 'maplibre-gl'
import {
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Map as MapLibreMap,
  Source,
} from 'react-map-gl/maplibre'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ResolvedTheme } from '@/lib/theme'

/** GeoJSON feature collection of location points understood by `<MapView />`. */
export type MarkerCollection = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  {
    /** Stable location id — used both for selection and click callbacks. */
    id: string
    /** Indonesian display name. */
    nameId: string
    /** Arabic display name (optional but recommended for tooltips). */
    nameAr?: string
    /** Modern-day name (optional). */
    modernName?: string | null
    /** ISO 3166 alpha-2/3 country code (optional). */
    countryCode?: string | null
  }
>

export interface MapViewProps {
  markers: MarkerCollection
  selectedId?: string
  onMarkerClick?: (id: string) => void
  /** Mekkah default — [lng, lat]. */
  initialCenter?: [number, number]
  initialZoom?: number
  /** Toggle Hijrah route (Mekkah → Madinah) overlay. */
  showHijrahRoute?: boolean
  className?: string
}

// Mekkah — [lng, lat].  WIREFRAMES §10 picks Mecca as the natural focal point.
const MECCA: [number, number] = [39.8262, 21.4225]
// Madinah — used only for the Hijrah route geometry.
const MADINAH: [number, number] = [39.6142, 24.4672]

/**
 * Raster basemap style.  Switches the tile URL based on the active theme so
 * the canvas matches the rest of the UI (CARTO Dark Matter for dark mode,
 * CARTO Positron for light).
 */
function rasterStyle(theme: ResolvedTheme): StyleSpecification {
  const url =
    theme === 'dark'
      ? 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      : 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'

  return {
    version: 8,
    sources: {
      'osm-raster': {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'osm-raster',
        type: 'raster',
        source: 'osm-raster',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  } satisfies StyleSpecification
}

/**
 * Read the document's active theme from `<html data-theme>`.  Falls back to
 * `light` during SSR or when the attribute hasn't been written yet.
 */
function readDocTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  const value = document.documentElement.dataset.theme
  return value === 'dark' ? 'dark' : 'light'
}

export function MapView({
  markers,
  selectedId,
  onMarkerClick,
  initialCenter = MECCA,
  initialZoom = 4,
  showHijrahRoute = false,
  className,
}: MapViewProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [theme, setTheme] = useState<ResolvedTheme>(() => readDocTheme())

  // Theme-watch — sync the raster basemap with the rest of the UI.  We use a
  // MutationObserver on `<html>` rather than wiring through React props so the
  // map keeps reacting even if the parent forgets to forward the theme.
  useEffect(() => {
    if (typeof document === 'undefined') return
    setTheme(readDocTheme())
    const obs = new MutationObserver(() => setTheme(readDocTheme()))
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => obs.disconnect()
  }, [])

  const mapStyle = useMemo(() => rasterStyle(theme), [theme])

  // Hijrah route — a single LineString from Mekkah to Madinah.  Stored as a
  // memoised collection so identity is stable across renders (otherwise the
  // `<Source>` would tear down its tiles).
  const hijrahCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Hijrah Mekkah → Madinah' },
          geometry: {
            type: 'LineString',
            coordinates: [MECCA, MADINAH],
          },
        },
      ],
    }),
    [],
  )

  // Selection filter — MapLibre expression that matches features whose `id`
  // property equals the current selectedId.  When nothing is selected we pin
  // an impossible match so the ring layer renders nothing.
  // FilterSpecification is a giant union — TS won't narrow literal arrays to
  // its tuple shape, so cast at the boundary.
  const selectedFilter = useMemo<FilterSpecification>(
    () => ['==', ['get', 'id'], selectedId ?? '__none__'] as unknown as FilterSpecification,
    [selectedId],
  )

  // Click handler.  Two cases:
  //   1. Tap on a cluster → zoom in to its expansion level.
  //   2. Tap on an individual point → bubble up via `onMarkerClick`.
  const onClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature) return
      const map = mapRef.current?.getMap()
      if (!map) return

      // Cluster: zoom to the cluster's expansion.  In maplibre-gl v5 the API
      // is Promise-based, so we await the resolved zoom before easing.
      if (feature.properties?.cluster) {
        const clusterId = feature.properties.cluster_id as number
        const src = map.getSource('locations') as GeoJSONSource | undefined
        if (!src) return
        void src
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            const coords = (feature.geometry as GeoJSON.Point).coordinates
            const lng = coords[0] ?? 0
            const lat = coords[1] ?? 0
            map.easeTo({ center: [lng, lat], zoom, duration: 400 })
          })
          .catch(() => {
            /* cluster gone (data churn) — silently ignore */
          })
        return
      }

      const id = feature.properties?.id as string | undefined
      if (id && onMarkerClick) onMarkerClick(id)
    },
    [onMarkerClick],
  )

  // Cursor feedback — pointer over interactive layers.
  const onMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])
  const onMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = ''
  }, [])

  return (
    <div className={className} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapLibreMap
        ref={mapRef}
        initialViewState={{
          longitude: initialCenter[0],
          latitude: initialCenter[1],
          zoom: initialZoom,
        }}
        mapStyle={mapStyle}
        // Interactive layers — the click handler only fires when one of these
        // is hit, so MapLibre filters out clicks on the basemap automatically.
        interactiveLayerIds={['clusters', 'unclustered']}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <Source
          id="locations"
          type="geojson"
          data={markers}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
          // `id` is stored as a feature property; `generateId` would clobber it.
          promoteId="id"
        >
          {/* Cluster bubbles — color & radius stepped by point_count. */}
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count'] as FilterSpecification}
            paint={
              {
                'circle-color': [
                  'step',
                  ['get', 'point_count'],
                  '#10b981', // emerald-500
                  10,
                  '#059669', // emerald-600
                  50,
                  '#047857', // emerald-700
                  200,
                  '#064e3b', // emerald-900
                ] as unknown as ExpressionSpecification,
                'circle-radius': [
                  'step',
                  ['get', 'point_count'],
                  16,
                  10,
                  20,
                  50,
                  26,
                  200,
                  32,
                ] as unknown as ExpressionSpecification,
                'circle-stroke-width': 2,
                'circle-stroke-color': 'rgba(255,255,255,0.85)',
              } satisfies CircleLayerSpecification['paint']
            }
          />
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count'] as FilterSpecification}
            layout={
              {
                'text-field': ['get', 'point_count_abbreviated'] as unknown as ExpressionSpecification,
                'text-size': 12,
                'text-allow-overlap': true,
              } satisfies SymbolLayerSpecification['layout']
            }
            paint={
              {
                'text-color': '#ffffff',
              } satisfies SymbolLayerSpecification['paint']
            }
          />

          {/* Individual locations — small emerald disc. */}
          <Layer
            id="unclustered"
            type="circle"
            filter={['!', ['has', 'point_count']] as FilterSpecification}
            paint={
              {
                'circle-color': '#10b981',
                'circle-radius': 7,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              } satisfies CircleLayerSpecification['paint']
            }
          />

          {/* Selection ring — sits above `unclustered` and only renders when
              its filter matches the active id. */}
          <Layer
            id="selected-ring"
            type="circle"
            filter={selectedFilter}
            paint={
              {
                'circle-color': 'rgba(0,0,0,0)',
                'circle-radius': 14,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#f59e0b', // amber-500
              } satisfies CircleLayerSpecification['paint']
            }
          />
        </Source>

        {/* Hijrah route overlay — separate source so it can be toggled. */}
        {showHijrahRoute ? (
          <Source id="hijrah-route" type="geojson" data={hijrahCollection}>
            <Layer
              id="hijrah-route-line"
              type="line"
              paint={
                {
                  'line-color': '#f59e0b',
                  'line-width': 3,
                  'line-dasharray': [2, 2],
                } satisfies LineLayerSpecification['paint']
              }
            />
          </Source>
        ) : null}
      </MapLibreMap>
    </div>
  )
}

export default MapView
