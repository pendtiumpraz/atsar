// `<FigureMarker />` — optional HTML/SVG marker used as a Maplibre `<Marker>`
// child when callers want a richer pin than the layer-driven circles in
// `<MapView />`.
//
// The main map (`<MapView />`) draws individual points via MapLibre `circle`
// layers for performance.  This component is kept here for two niche cases:
//   1. The "single-character" mini-map (WIREFRAMES §11) where we want a
//      numbered marker per life event.
//   2. Sparse highlight pins (selected city emphasis with label).
//
// It's a tiny SVG so it stays crisp at any zoom and doesn't add the cost of
// a third-party icon set.

'use client'

import { cn } from '@/lib/utils'

export interface FigureMarkerProps {
  /** Display label inside the pin (e.g., a sequence number "1"). */
  label?: string | number
  /** Tone of the pin — `primary` is emerald, `accent` is amber, `muted` is grey. */
  tone?: 'primary' | 'accent' | 'muted'
  /** Active style — slightly larger with a ring. */
  active?: boolean
  /** Accessible name read by screen readers. */
  ariaLabel?: string
  /** Optional click handler — Maplibre's `<Marker onClick>` also works. */
  onClick?: () => void
  className?: string
}

const TONE_CLASSES: Record<NonNullable<FigureMarkerProps['tone']>, string> = {
  primary: 'fill-emerald-500 text-white',
  accent: 'fill-amber-500 text-white',
  muted: 'fill-zinc-500 text-white',
}

/**
 * Renders an inline SVG pin.  The shape is a classic teardrop with a centred
 * circle for the label.  Width/height stay constant; we only animate scale +
 * shadow to keep paints cheap.
 */
export function FigureMarker({
  label,
  tone = 'primary',
  active = false,
  ariaLabel,
  onClick,
  className,
}: FigureMarkerProps) {
  const dimension = active ? 36 : 28

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (label != null ? `Marker ${label}` : 'Marker')}
      className={cn(
        'group inline-flex -translate-y-1/2 items-center justify-center bg-transparent p-0 transition-transform focus-visible:outline-none',
        active && 'drop-shadow-md',
        className,
      )}
      style={{ width: dimension, height: dimension }}
    >
      <svg
        viewBox="0 0 24 24"
        width={dimension}
        height={dimension}
        aria-hidden="true"
        className={cn(TONE_CLASSES[tone], 'transition-transform group-hover:scale-110')}
      >
        {/* Pin body — outline is white to ensure contrast on any basemap. */}
        <path
          d="M12 0c-5 0-9 4-9 9 0 6.5 9 15 9 15s9-8.5 9-15c0-5-4-9-9-9z"
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        {/* Inner circle to host the label. */}
        <circle cx={12} cy={9} r={4} className="fill-white/95" />
        {label != null ? (
          <text
            x={12}
            y={11.5}
            textAnchor="middle"
            fontSize={6}
            fontWeight={700}
            className="fill-current text-[rgb(var(--text))]"
            style={{ fill: 'currentColor' }}
          >
            {String(label)}
          </text>
        ) : null}
      </svg>
    </button>
  )
}

export default FigureMarker
