// Client-only interactive marketing map.
//
// Renders a real MapLibre canvas (CARTO Voyager / Dark Matter raster tiles) for
// the landing-page "Pahami sirah lewat geografi" section. Overlays:
//   - Translucent approximate polygons for historical Islamic-era regions
//     (Hijaz, Najd, Yemen, Syam, Iraq, Misr, Khurasan, Andalusia, Maghrib).
//   - 15 city pins with hover popup (Indonesian + Arabic + optional note).
//   - Dashed Hijrah route line Mekkah → Madinah.
//
// Theme awareness: a MutationObserver on `<html data-theme>` swaps the basemap
// tiles between Voyager (light) and Dark Matter (dark) so the map matches the
// rest of the marketing surface without a remount.
//
// MapLibre touches `window` at module load, so this module is always loaded via
// `next/dynamic({ ssr: false })` from `map-spoiler.tsx`.

'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import {
  type CircleLayerSpecification,
  type ExpressionSpecification,
  type FillLayerSpecification,
  type LineLayerSpecification,
  type StyleSpecification,
  type SymbolLayerSpecification,
} from 'maplibre-gl'
import {
  Layer,
  type MapLayerMouseEvent,
  type MapRef,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
} from 'react-map-gl/maplibre'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ResolvedTheme } from '@/lib/theme'

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

// Mekkah & Madinah used for both the city pins and the Hijrah route geometry.
const MEKKAH: [number, number] = [39.8262, 21.4225]
const MADINAH: [number, number] = [39.6142, 24.4709]

type CityPin = {
  id: string
  nameId: string
  nameAr: string
  note?: string
  /** [lng, lat] */
  coord: [number, number]
}

const CITIES: ReadonlyArray<CityPin> = [
  { id: 'makkah', nameId: 'Mekkah', nameAr: 'مكة', note: 'Kelahiran Nabi ﷺ', coord: MEKKAH },
  { id: 'madinah', nameId: 'Madinah', nameAr: 'المدينة', coord: MADINAH },
  { id: 'badr', nameId: 'Badar', nameAr: 'بدر', note: 'Perang Badar', coord: [38.7833, 23.7833] },
  { id: 'al-quds', nameId: 'Al-Quds', nameAr: 'القدس', coord: [35.2137, 31.7683] },
  { id: 'damascus', nameId: 'Damaskus', nameAr: 'دمشق', coord: [36.2765, 33.5138] },
  { id: 'yarmuk', nameId: 'Yarmuk', nameAr: 'اليرموك', note: 'Perang Yarmuk', coord: [35.95, 32.65] },
  { id: 'baghdad', nameId: 'Baghdad', nameAr: 'بغداد', coord: [44.3661, 33.3152] },
  { id: 'kufah', nameId: 'Kufah', nameAr: 'الكوفة', coord: [44.4009, 32.0289] },
  { id: 'bashrah', nameId: 'Bashrah', nameAr: 'البصرة', coord: [47.7833, 30.5] },
  { id: 'qadisiyyah', nameId: 'Qadisiyyah', nameAr: 'القادسية', coord: [44.25, 31.65] },
  { id: 'bukhara', nameId: 'Bukhara', nameAr: 'بخارى', note: 'Imam Bukhari', coord: [64.4286, 39.7747] },
  { id: 'naysabur', nameId: 'Naysabur', nameAr: 'نيسابور', note: 'Imam Muslim', coord: [58.7958, 36.2126] },
  { id: 'fustat', nameId: 'Fustat', nameAr: 'الفسطاط', coord: [31.2333, 30.0061] },
  { id: 'cordoba', nameId: 'Cordoba', nameAr: 'قرطبة', coord: [-4.7794, 37.8847] },
  { id: 'shanaa', nameId: "Shan'a", nameAr: 'صنعاء', coord: [44.191, 15.3694] },
]

/** Historical region polygon (intentionally rectangular — approximate, not political). */
type Region = {
  id: string
  /** Short label shown on the map (uppercase). */
  label: string
  /** Fill color (hex) — also reused by the legend in the server wrapper. */
  color: string
  /** [lng, lat] vertices, closed ring built at runtime. */
  ring: ReadonlyArray<[number, number]>
}

export const REGIONS: ReadonlyArray<Region> = [
  {
    id: 'hijaz',
    label: 'HIJAZ',
    color: '#10b981', // emerald
    ring: [
      [34.5, 17.5],
      [42.5, 17.5],
      [42.5, 28.5],
      [34.5, 28.5],
    ],
  },
  {
    id: 'najd',
    label: 'NAJD',
    color: '#f59e0b', // amber
    ring: [
      [42.5, 19],
      [50, 19],
      [50, 28],
      [42.5, 28],
    ],
  },
  {
    id: 'yemen',
    label: 'YAMAN',
    color: '#ef4444', // red
    ring: [
      [42, 12],
      [53, 12],
      [53, 18],
      [42, 18],
    ],
  },
  {
    id: 'syam',
    label: 'SYAM',
    color: '#8b5cf6', // violet
    ring: [
      [34, 30],
      [42, 30],
      [42, 37.5],
      [34, 37.5],
    ],
  },
  {
    id: 'iraq',
    label: 'IRAQ',
    color: '#0ea5e9', // sky
    ring: [
      [39, 29],
      [48.5, 29],
      [48.5, 37.5],
      [39, 37.5],
    ],
  },
  {
    id: 'misr',
    label: 'MISR',
    color: '#d97706', // amber-dark
    ring: [
      [24, 22],
      [35, 22],
      [35, 31.5],
      [24, 31.5],
    ],
  },
  {
    id: 'khurasan',
    label: 'KHURASAN',
    color: '#14b8a6', // teal
    ring: [
      [55, 30],
      [71, 30],
      [71, 41],
      [55, 41],
    ],
  },
  {
    id: 'andalusia',
    label: 'ANDALUSIA',
    color: '#ec4899', // pink
    ring: [
      [-9.5, 36],
      [3, 36],
      [3, 43.5],
      [-9.5, 43.5],
    ],
  },
  {
    id: 'maghrib',
    label: 'MAGHRIB',
    color: '#84cc16', // lime
    ring: [
      [-9, 27],
      [25, 27],
      [25, 37],
      [-9, 37],
    ],
  },
]

// ---------------------------------------------------------------------------
// Basemap (CARTO raster — Voyager / Dark Matter)
// ---------------------------------------------------------------------------

function rasterStyle(theme: ResolvedTheme): StyleSpecification {
  const url =
    theme === 'dark'
      ? 'https://basemaps.cartocdn.com/raster/dark-matter/{z}/{x}/{y}.png'
      : 'https://basemaps.cartocdn.com/raster/voyager/{z}/{x}/{y}.png'

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

function readDocTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  const value = document.documentElement.dataset.theme
  return value === 'dark' ? 'dark' : 'light'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type HoverState = {
  city: CityPin
  /** [lng, lat] anchor for the popup. */
  coord: [number, number]
}

export function MapSpoilerInteractive() {
  const mapRef = useRef<MapRef | null>(null)
  const [theme, setTheme] = useState<ResolvedTheme>(() => readDocTheme())
  const [hover, setHover] = useState<HoverState | null>(null)

  // Theme watcher — mirror map-view.tsx so the basemap stays in sync without
  // requiring a remount. We attach once and disconnect on unmount.
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

  // Region polygons — built once. Each feature carries its color so a single
  // `data-driven` fill/line/symbol layer can render the whole collection.
  const regionCollection = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Polygon, { id: string; name: string; color: string }>
  >(() => {
    return {
      type: 'FeatureCollection',
      features: REGIONS.map((r) => ({
        type: 'Feature',
        properties: { id: r.id, name: r.label, color: r.color },
        geometry: {
          type: 'Polygon',
          // GeoJSON Polygon coordinates must form a closed ring (first === last).
          coordinates: [[...r.ring.map<[number, number]>((p) => [p[0], p[1]]), [r.ring[0]![0], r.ring[0]![1]]]],
        },
      })),
    }
  }, [])

  // City pins.
  const cityCollection = useMemo<
    GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; nameId: string; nameAr: string; note?: string }>
  >(() => {
    return {
      type: 'FeatureCollection',
      features: CITIES.map((c) => ({
        type: 'Feature',
        properties: {
          id: c.id,
          nameId: c.nameId,
          nameAr: c.nameAr,
          ...(c.note ? { note: c.note } : {}),
        },
        geometry: { type: 'Point', coordinates: [c.coord[0], c.coord[1]] },
      })),
    }
  }, [])

  // Hijrah route — single dashed LineString Mekkah → Madinah.
  const hijrahCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Hijrah Mekkah → Madinah' },
          geometry: { type: 'LineString', coordinates: [MEKKAH, MADINAH] },
        },
      ],
    }),
    [],
  )

  // Hover / click handlers for city pins. We surface the city under the cursor
  // through `setHover` and render a `<Popup>` anchored to its coordinates.
  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    if (!feature || feature.layer?.id !== 'city-pins') {
      setHover(null)
      return
    }
    const props = feature.properties as Record<string, string> | null
    const id = props?.id
    if (!id) return
    const city = CITIES.find((c) => c.id === id)
    if (!city) return
    setHover({ city, coord: city.coord })
  }, [])

  const handleMouseLeave = useCallback(() => setHover(null), [])

  const handleClick = useCallback((event: MapLayerMouseEvent) => {
    const feature = event.features?.[0]
    if (!feature || feature.layer?.id !== 'city-pins') return
    const props = feature.properties as Record<string, string> | null
    const id = props?.id
    if (!id) return
    const city = CITIES.find((c) => c.id === id)
    if (!city) return
    setHover({ city, coord: city.coord })
  }, [])

  // Cursor feedback over interactive points.
  const onCanvasMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = 'pointer'
  }, [])
  const onCanvasMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) map.getCanvas().style.cursor = ''
  }, [])

  return (
    <div
      className="relative h-[480px] w-full overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] sm:h-[560px]"
    >
      <MapLibreMap
        ref={mapRef}
        initialViewState={{ longitude: 39, latitude: 28, zoom: 3 }}
        minZoom={1}
        maxZoom={10}
        mapStyle={mapStyle}
        // Lock rotation — north stays up so users can map historical regions
        // onto the modern world without mental gymnastics.
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        interactiveLayerIds={['city-pins']}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onMouseEnter={onCanvasMouseEnter}
        onMouseOut={onCanvasMouseLeave}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <ScaleControl position="bottom-left" unit="metric" />

        {/* Region polygons. Three layers off the same source: fill + outline + label. */}
        <Source id="regions" type="geojson" data={regionCollection}>
          <Layer
            id="region-fill"
            type="fill"
            paint={
              {
                'fill-color': ['get', 'color'] as unknown as ExpressionSpecification,
                'fill-opacity': 0.25,
              } satisfies FillLayerSpecification['paint']
            }
          />
          <Layer
            id="region-outline"
            type="line"
            paint={
              {
                'line-color': ['get', 'color'] as unknown as ExpressionSpecification,
                'line-width': 1.5,
                'line-opacity': 0.9,
              } satisfies LineLayerSpecification['paint']
            }
          />
          <Layer
            id="region-label"
            type="symbol"
            layout={
              {
                'text-field': ['get', 'name'] as unknown as ExpressionSpecification,
                'text-size': 12,
                'text-letter-spacing': 0.12,
                'text-font': ['Open Sans Regular'],
                'text-allow-overlap': false,
                'symbol-placement': 'point',
              } satisfies SymbolLayerSpecification['layout']
            }
            paint={
              {
                'text-color': ['get', 'color'] as unknown as ExpressionSpecification,
                'text-halo-color':
                  theme === 'dark' ? 'rgba(15,13,10,0.85)' : 'rgba(250,245,235,0.9)',
                'text-halo-width': 1.5,
              } satisfies SymbolLayerSpecification['paint']
            }
          />
        </Source>

        {/* Hijrah route — dashed line on top of the region fills. */}
        <Source id="hijrah-route" type="geojson" data={hijrahCollection}>
          <Layer
            id="hijrah-route-line"
            type="line"
            paint={
              {
                'line-color': 'rgb(184,153,104)', // antique gold — accent
                'line-width': 2,
                'line-dasharray': [2, 2],
              } satisfies LineLayerSpecification['paint']
            }
          />
        </Source>

        {/* City pins. Inner emerald disc + white stroke, on top of everything. */}
        <Source id="cities" type="geojson" data={cityCollection} promoteId="id">
          <Layer
            id="city-pins"
            type="circle"
            paint={
              {
                'circle-color': theme === 'dark' ? '#4abc95' : '#0f4c3a',
                'circle-radius': 6,
                'circle-stroke-width': 2,
                'circle-stroke-color': theme === 'dark' ? '#0f0d0a' : '#faf5eb',
              } satisfies CircleLayerSpecification['paint']
            }
          />
          <Layer
            id="city-label"
            type="symbol"
            layout={
              {
                'text-field': ['get', 'nameId'] as unknown as ExpressionSpecification,
                'text-size': 11,
                'text-offset': [0, 1.2],
                'text-anchor': 'top',
                'text-font': ['Open Sans Regular'],
                'text-allow-overlap': false,
              } satisfies SymbolLayerSpecification['layout']
            }
            paint={
              {
                'text-color': theme === 'dark' ? '#faf5eb' : '#1f1810',
                'text-halo-color':
                  theme === 'dark' ? 'rgba(15,13,10,0.85)' : 'rgba(250,245,235,0.9)',
                'text-halo-width': 1.5,
              } satisfies SymbolLayerSpecification['paint']
            }
          />
        </Source>

        {hover ? (
          <Popup
            longitude={hover.coord[0]}
            latitude={hover.coord[1]}
            anchor="bottom"
            offset={12}
            closeButton={false}
            closeOnClick={false}
            className="map-spoiler-popup"
          >
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-[rgb(var(--text))]">{hover.city.nameId}</div>
              <div
                className="text-[rgb(var(--text-muted))]"
                style={{ fontFamily: 'var(--font-display-arabic, serif)' }}
              >
                {hover.city.nameAr}
              </div>
              {hover.city.note ? (
                <div className="text-[rgb(var(--accent))]">{hover.city.note}</div>
              ) : null}
            </div>
          </Popup>
        ) : null}
      </MapLibreMap>
    </div>
  )
}

export default MapSpoilerInteractive
