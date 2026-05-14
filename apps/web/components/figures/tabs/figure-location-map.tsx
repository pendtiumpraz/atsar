// Inline MapLibre map for the figure detail "Peta" tab.
//
// We deliberately do NOT route through `components/map/map-view.tsx` here:
// that component is tuned for the global /map page (clustered emerald
// markers, side panel, Hijrah overlay).  The figure tab needs:
//   - A bounded canvas (~360px tall) that fits inline in the detail card.
//   - Per-role marker colors (birthplace = green, martyr = red, burial =
//     purple, residence/dakwah = blue) so the legend reads at a glance.
//   - Auto-fit bounds to all of the figure's locations.
// Building those on top of `MapView` would mean threading 3 new props for
// a one-off use case; a small dedicated wrapper is cleaner.
//
// MapLibre touches `window` at module load, so callers must lazy-load this
// via `next/dynamic({ ssr: false })`.  The `figure-peta-tab.tsx` does that.

'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import {
  type CircleLayerSpecification,
  type ExpressionSpecification,
  type FilterSpecification,
  type StyleSpecification,
  type SymbolLayerSpecification,
} from 'maplibre-gl'
import {
  Layer,
  type MapRef,
  Map as MapLibreMap,
  Source,
} from 'react-map-gl/maplibre'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { ResolvedTheme } from '@/lib/theme'

import type { FigureLocationEntry } from '../figure-detail'

export interface FigureLocationMapProps {
  /** Pre-filtered to entries whose `location.coordinates` is non-null. */
  locations: FigureLocationEntry[]
  /** Tailwind class for outer wrapper sizing. */
  className?: string
}

// Mekkah — used as a sensible fallback center when only one pin is plotted.
const MECCA: [number, number] = [39.8262, 21.4225]

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
    layers: [{ id: 'osm-raster', type: 'raster', source: 'osm-raster', minzoom: 0, maxzoom: 19 }],
  } satisfies StyleSpecification
}

function readDocTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  const value = document.documentElement.dataset.theme
  return value === 'dark' ? 'dark' : 'light'
}

/** Hex color for each `figure_locations.role`. Reads in the legend too. */
const ROLE_COLORS: Record<FigureLocationEntry['role'], string> = {
  birthplace: '#16a34a', // green-600
  martyr: '#dc2626', // red-600
  burial: '#7c3aed', // violet-600
  residence: '#2563eb', // blue-600
  dakwah: '#0891b2', // cyan-600
}

function rolePaintExpr(): ExpressionSpecification {
  return [
    'match',
    ['get', 'role'],
    'birthplace',
    ROLE_COLORS.birthplace,
    'martyr',
    ROLE_COLORS.martyr,
    'burial',
    ROLE_COLORS.burial,
    'residence',
    ROLE_COLORS.residence,
    'dakwah',
    ROLE_COLORS.dakwah,
    /* default */ '#2563eb',
  ] as unknown as ExpressionSpecification
}

/** Convert location entries into a GeoJSON FeatureCollection with role + name properties. */
function buildCollection(
  locations: FigureLocationEntry[],
): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; role: string; nameId: string; nameAr: string }> {
  return {
    type: 'FeatureCollection',
    features: locations
      .filter((l) => l.location.coordinates != null)
      .map((l) => ({
        type: 'Feature',
        id: l.id,
        geometry: l.location.coordinates as GeoJSON.Point,
        properties: {
          id: l.id,
          role: l.role,
          nameId: l.location.nameId,
          nameAr: l.location.nameAr,
        },
      })),
  }
}

/** Compute [west, south, east, north] from all marker coordinates. */
function computeBounds(
  fc: GeoJSON.FeatureCollection<GeoJSON.Point>,
): [number, number, number, number] | null {
  if (fc.features.length === 0) return null
  let minLng = 180
  let minLat = 90
  let maxLng = -180
  let maxLat = -90
  for (const f of fc.features) {
    const [lng, lat] = f.geometry.coordinates
    if (typeof lng !== 'number' || typeof lat !== 'number') continue
    if (lng < minLng) minLng = lng
    if (lat < minLat) minLat = lat
    if (lng > maxLng) maxLng = lng
    if (lat > maxLat) maxLat = lat
  }
  return [minLng, minLat, maxLng, maxLat]
}

export function FigureLocationMap({ locations, className }: FigureLocationMapProps) {
  const mapRef = useRef<MapRef | null>(null)
  const [theme, setTheme] = useState<ResolvedTheme>(() => readDocTheme())

  useEffect(() => {
    if (typeof document === 'undefined') return
    setTheme(readDocTheme())
    const obs = new MutationObserver(() => setTheme(readDocTheme()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const mapStyle = useMemo(() => rasterStyle(theme), [theme])
  const collection = useMemo(() => buildCollection(locations), [locations])
  const bounds = useMemo(() => computeBounds(collection), [collection])

  // Auto-fit on mount + whenever the bounds change.
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (!bounds) return
    const [w, s, e, n] = bounds
    if (w === e && s === n) {
      map.easeTo({ center: [w, s], zoom: 7, duration: 300 })
    } else {
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 40, maxZoom: 9, duration: 400 },
      )
    }
    // We intentionally re-run on bounds changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds?.[0], bounds?.[1], bounds?.[2], bounds?.[3]])

  const paint = useMemo<CircleLayerSpecification['paint']>(
    () => ({
      'circle-color': rolePaintExpr(),
      'circle-radius': 8,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    }),
    [],
  )

  return (
    <div className={className} style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapLibreMap
        ref={mapRef}
        initialViewState={{ longitude: MECCA[0], latitude: MECCA[1], zoom: 4 }}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactiveLayerIds={['figure-locations']}
      >
        <Source id="figure-locations-src" type="geojson" data={collection} promoteId="id">
          <Layer
            id="figure-locations"
            type="circle"
            paint={paint}
            filter={['has', 'role'] as FilterSpecification}
          />
          <Layer
            id="figure-locations-label"
            type="symbol"
            layout={
              {
                'text-field': ['get', 'nameId'] as unknown as ExpressionSpecification,
                'text-size': 11,
                'text-anchor': 'top',
                'text-offset': [0, 0.9],
                'text-allow-overlap': false,
                'text-optional': true,
              } satisfies SymbolLayerSpecification['layout']
            }
            paint={
              {
                'text-color': 'rgb(17, 24, 39)',
                'text-halo-color': 'rgba(255, 255, 255, 0.95)',
                'text-halo-width': 1.5,
              } satisfies SymbolLayerSpecification['paint']
            }
          />
        </Source>
      </MapLibreMap>
    </div>
  )
}

export default FigureLocationMap
