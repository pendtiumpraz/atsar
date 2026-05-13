// `<LocationMapPicker />` — single-marker MapLibre picker for admin forms.
//
// Behaviour:
//   - Renders a theme-aware CARTO raster basemap (light = Positron, dark =
//     Dark Matter), tracking `<html data-theme>` exactly like the public
//     `<MapView />` does — see P5-3 (`components/map/map-view.tsx`).
//   - One draggable `<Marker />` pinned at the controlled `lat` / `lng`.
//   - Clicking anywhere on the basemap moves the marker there.
//   - Dragging the marker fires `onChange` on drag-end (cheap & avoids
//     spamming the parent every animation frame).
//   - Lat/lng inputs in the parent stay authoritative — the picker is
//     fully controlled.  We re-center the map only on the very first mount
//     so the user can pan / zoom freely afterwards.
//
// Why a `<Marker />` (DOM) instead of a `<Source />` circle layer?
//   Drag support comes for free with `react-map-gl/maplibre`'s Marker
//   wrapper.  For a single-point picker the DOM overhead is trivial and the
//   declarative API is much easier to reason about.

'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StyleSpecification } from 'maplibre-gl'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type MapLayerMouseEvent,
  type MapRef,
  type MarkerDragEvent,
} from 'react-map-gl/maplibre'
import { MapPin } from 'lucide-react'

import type { ResolvedTheme } from '@/lib/theme'

export interface LocationMapPickerProps {
  /** Current latitude (controlled). */
  lat: number
  /** Current longitude (controlled). */
  lng: number
  /** Called whenever the user moves the marker (click or drag-end). */
  onChange: (next: { lat: number; lng: number }) => void
  /** Initial zoom level — defaults to a country-level view. */
  initialZoom?: number
}

/** CARTO raster basemap — see `<MapView />` for the rationale. */
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
  }
}

function readDocTheme(): ResolvedTheme {
  if (typeof document === 'undefined') return 'light'
  const value = document.documentElement.dataset.theme
  return value === 'dark' ? 'dark' : 'light'
}

/** Clamp + sanity-check raw drag values before bubbling up. */
function sanitize(lat: number, lng: number): { lat: number; lng: number } {
  const safeLat = Math.max(-90, Math.min(90, lat))
  const safeLng = Math.max(-180, Math.min(180, lng))
  return { lat: safeLat, lng: safeLng }
}

export function LocationMapPicker({
  lat,
  lng,
  onChange,
  initialZoom = 5,
}: LocationMapPickerProps) {
  const mapRef = useRef<MapRef | null>(null)

  const [theme, setTheme] = useState<ResolvedTheme>(() => readDocTheme())
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

  // Keep the marker on screen when the inputs are typed directly.  We don't
  // re-center on every render (that would fight the user's panning); instead
  // we ease towards the new point only when it falls outside the visible
  // bounds.
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const bounds = map.getBounds()
    if (!bounds) return
    if (!bounds.contains([lng, lat])) {
      map.easeTo({ center: [lng, lat], duration: 300 })
    }
  }, [lat, lng])

  // Move marker on map click.
  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const next = sanitize(e.lngLat.lat, e.lngLat.lng)
      onChange(next)
    },
    [onChange],
  )

  // Marker drag-end — single update at the end of the gesture.
  const handleDragEnd = useCallback(
    (e: MarkerDragEvent) => {
      const next = sanitize(e.lngLat.lat, e.lngLat.lng)
      onChange(next)
    },
    [onChange],
  )

  // Sanity defaults for the very first render (form may pass NaN momentarily).
  const safeLat = Number.isFinite(lat) ? lat : 21.4225
  const safeLng = Number.isFinite(lng) ? lng : 39.8262

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <MapLibreMap
        ref={mapRef}
        initialViewState={{
          longitude: safeLng,
          latitude: safeLat,
          zoom: initialZoom,
        }}
        mapStyle={mapStyle}
        onClick={handleClick}
        // Pointer cursor by default — clicking moves the pin, so the
        // affordance should be obvious.
        cursor="crosshair"
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        <Marker
          longitude={safeLng}
          latitude={safeLat}
          anchor="bottom"
          draggable
          onDragEnd={handleDragEnd}
        >
          <span
            className="flex items-center justify-center drop-shadow-md"
            style={{ color: 'rgb(var(--accent))' }}
            aria-label="Pin lokasi"
          >
            <MapPin className="h-7 w-7" fill="currentColor" strokeWidth={1.5} />
          </span>
        </Marker>
      </MapLibreMap>
    </div>
  )
}

export default LocationMapPicker
