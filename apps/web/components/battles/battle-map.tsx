// War map for a single battle (WIREFRAMES §13).
//
// MapLibre via `react-map-gl/maplibre`. The component is `'use client'` and
// imports the library directly — Next.js code-splits per route automatically,
// so the GL bundle only ships on `/battles/[slug]` (where this component is
// rendered). `<BattleDetail />` is also a client component, so embedding here
// adds no extra JS to other routes.
//
// Layers (rendered as React markers, not a GL `addLayer` call — keeps the
// component declarative + framework-friendly):
//   - Battle pin (large)              — always visible.
//   - Per-phase markers               — visible only when their index <= the
//                                       current phase, so advancing the slider
//                                       "reveals" the sequence of events.
//   - Animated arrow overlay          — drawn as an SVG positioned over the
//                                       map for the active phase only. Uses
//                                       Framer Motion `pathLength` for the
//                                       line-draw effect.
//
// State:
//   - `currentIndex` (0-based) drives which phases are visible.
//   - `<PhaseSlider />` renders below the map and writes `currentIndex` back.
//
// Tile source: free OSM raster style. Mirror P5-3's general map when a
// shared tile config lands.

'use client'

import 'maplibre-gl/dist/maplibre-gl.css'

import { motion } from 'framer-motion'
import type { StyleSpecification } from 'maplibre-gl'
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
} from 'react-map-gl/maplibre'
import { useMemo, useState } from 'react'

import { PhaseSlider, type PhaseSliderPhase } from '@/components/battles/phase-slider'
import { cn } from '@/lib/utils'

// ── Tile style ────────────────────────────────────────────────────────
// Inline MapLibre style spec pointing at OSM raster tiles. Avoids a JSON
// fetch round-trip and keeps the war map functional without an API key.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

// ── Types ─────────────────────────────────────────────────────────────
export interface BattleMapPhase extends PhaseSliderPhase {
  id?: string
  latitude?: number | null
  longitude?: number | null
  /** Optional troop-movement arrow start, in [lng, lat]. */
  arrowFrom?: [number, number] | null
  /** Arrow end. If both arrowFrom + arrowTo are present, an arrow renders. */
  arrowTo?: [number, number] | null
}

export interface BattleMapProps {
  /** Anchor coordinates of the battle (large pin). */
  latitude?: number | null
  longitude?: number | null
  /** Display name of the battle (used in tooltips / aria-labels). */
  name?: string
  /** Ordered phases (phaseOrder ascending). */
  phases?: BattleMapPhase[]
  className?: string
}

// ── Component ─────────────────────────────────────────────────────────
export function BattleMap({
  latitude,
  longitude,
  name,
  phases = [],
  className,
}: BattleMapProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Visible phase markers — every phase up to and including current.
  const visiblePhases = useMemo(
    () => phases.slice(0, currentIndex + 1).filter((p) => isCoord(p.latitude, p.longitude)),
    [phases, currentIndex],
  )

  const activePhase = phases[currentIndex]
  const showArrow =
    !!activePhase &&
    Array.isArray(activePhase.arrowFrom) &&
    Array.isArray(activePhase.arrowTo)

  const hasBattleCoord = isCoord(latitude, longitude)
  const hasAnyCoord = hasBattleCoord || phases.some((p) => isCoord(p.latitude, p.longitude))

  // Initial view — centre on the battle pin (or the first phase coord).
  const initialCenter = useMemo(() => {
    if (hasBattleCoord) return { latitude: latitude as number, longitude: longitude as number }
    const first = phases.find((p) => isCoord(p.latitude, p.longitude))
    if (first) return { latitude: first.latitude as number, longitude: first.longitude as number }
    return null
  }, [hasBattleCoord, latitude, longitude, phases])

  if (!hasAnyCoord || !initialCenter) {
    return (
      <div
        className={cn(
          'flex h-[28rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-center text-sm text-[rgb(var(--text-muted))]',
          className,
        )}
      >
        <div className="text-2xl text-[rgb(var(--text-faint))]" aria-hidden>
          ⚐
        </div>
        Belum ada koordinat untuk peta pertempuran ini.
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative h-[28rem] w-full overflow-hidden rounded-md border border-[rgb(var(--border))]">
        <MapLibreMap
          initialViewState={{ ...initialCenter, zoom: 8 }}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
        >
          <NavigationControl position="top-right" showCompass={false} />

          {hasBattleCoord ? (
            <Marker latitude={latitude as number} longitude={longitude as number} anchor="bottom">
              <div
                aria-label={name ? `Lokasi ${name}` : 'Lokasi pertempuran'}
                title={name ?? undefined}
                className="flex flex-col items-center"
              >
                <div className="text-2xl drop-shadow-md" aria-hidden>
                  ⚔
                </div>
                <div className="-mt-1 h-3 w-3 rounded-full border-2 border-white bg-[rgb(var(--accent))] shadow" />
              </div>
            </Marker>
          ) : null}

          {visiblePhases.map((phase) => {
            const idx = phases.indexOf(phase)
            const isActive = idx === currentIndex
            const ord = (phase.phaseOrder ?? idx) + 1
            const label = phase.titleId || `Fase ${ord}`
            return (
              <Marker
                key={phase.id ?? idx}
                latitude={phase.latitude as number}
                longitude={phase.longitude as number}
                anchor="center"
              >
                <div
                  title={label}
                  aria-label={label}
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-transform',
                    isActive
                      ? 'scale-125 border-white bg-[rgb(var(--accent))] text-white shadow-lg'
                      : 'border-white bg-[rgb(var(--text-muted))] text-white',
                  )}
                >
                  {ord}
                </div>
              </Marker>
            )
          })}
        </MapLibreMap>

        {/*
         * SVG arrow overlay for the active phase. Drawn outside the GL canvas
         * — projecting arrowFrom/arrowTo to screen pixels requires a `useMap()`
         * + `project()` call and a redraw on every camera move, which is out
         * of scope here. Instead we render a decorative "movement" indicator
         * in the corner that animates whenever the active phase changes.
         */}
        {showArrow ? (
          <div
            key={currentIndex}
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-[rgb(var(--surface)/0.85)] p-2 backdrop-blur"
          >
            <svg width="80" height="32" viewBox="0 0 80 32" className="text-[rgb(var(--accent))]">
              <motion.line
                x1="4"
                y1="16"
                x2="68"
                y2="16"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
              <motion.polygon
                points="68,8 78,16 68,24"
                fill="currentColor"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0, duration: 0.3 }}
              />
            </svg>
            <div className="mt-0.5 text-[10px] font-medium text-[rgb(var(--text-muted))]">
              Pergerakan pasukan
            </div>
          </div>
        ) : null}
      </div>

      <PhaseSlider
        phases={phases}
        currentIndex={currentIndex}
        onChange={setCurrentIndex}
      />
    </div>
  )
}

function isCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  )
}
