// Shared SVG-based timeline renderer for /timeline (comparison) and
// /timeline-ulama. Modelled after the landing-page spoiler at
// `components/marketing/timeline-spoiler.tsx` — the user explicitly
// asked for that visual language ("HARAPANKU ADALAH TIMELINENYA SAMA
// SEPERTI SPOILER DI DEPAN DI LANDING PAGE ITU BENER").
//
// Why pure SVG instead of vis-timeline:
//   - vis-timeline mutates DOM imperatively, reads `offsetHeight` in its
//     constructor, and has race conditions with React 19 strict-mode
//     mount/unmount. Users reported empty canvas symptoms repeatedly.
//   - SVG renders deterministically, scales via `viewBox`, and is
//     accessible by default.
//
// AH year handling:
//   - `birthDateAh` / `deathDateAh` are integers (negative = SH).
//   - Min/max year on the axis is auto-fit from the figures + a small
//     pad on either side.
//   - Dual axis: top tick shows `<N> H`, bottom tick shows
//     `<ahToCe(N)> M`. Tick step is 50 H by default, 100 H when range
//     exceeds 500 H.

'use client'

import { ahToCe } from '@athar/hijri'
import { useRouter } from 'next/navigation'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useMemo, useState } from 'react'

export interface TimelineSvgFigure {
  id: string
  slug: string
  nameFullId?: string | null
  nameFullAr?: string | null
  gender?: 'male' | 'female' | null
  birthDateAh?: number | null
  deathDateAh?: number | null
  /** Optional category label rendered under the figure name. */
  categoryLabel?: string | null
  /** Optional highlight markers (Hijrah, masuk Islam, …). */
  events?: Array<{ id?: string; ah: number; label: string }>
}

export interface TimelineSvgBand {
  /** Inclusive AH start year. Negative = SH. */
  startAh: number
  /** Inclusive AH end year. */
  endAh: number
  label: string
  /** CSS color (uses CSS vars). */
  fill?: string
}

export interface TimelineSvgProps {
  figures: TimelineSvgFigure[]
  /** Optional background bands rendered behind the bars (e.g. generation stripes). */
  bands?: TimelineSvgBand[]
  /** Render `<Link>` to /figures/[slug] on bar click. Default true. */
  linkable?: boolean
  /** Empty-state copy override. */
  emptyMessage?: string
}

// ── Layout constants — mirror the landing spoiler ────────────────────
const ROW_HEIGHT = 56
const PADDING_TOP = 64
const PADDING_BOTTOM = 48
const LABEL_GUTTER = 240
const PADDING_RIGHT = 32
const SVG_WIDTH = 880
const BAR_HEIGHT = 14
const BAR_OFFSET_Y = 16 // bar top within the row

function figureLabel(f: TimelineSvgFigure): string {
  return f.nameFullId || f.nameFullAr || f.slug
}

function formatAhYear(ah: number | null | undefined): string {
  if (typeof ah !== 'number') return '?'
  if (ah < 0) return `${-ah} SH`
  return `${ah} H`
}

function yearToX(year: number, minYear: number, maxYear: number): number {
  const usable = SVG_WIDTH - LABEL_GUTTER - PADDING_RIGHT
  const range = maxYear - minYear
  if (range <= 0) return LABEL_GUTTER
  return LABEL_GUTTER + ((year - minYear) / range) * usable
}

/** Pick a "nice" tick step given an AH range. */
function pickTickStep(range: number): number {
  if (range > 1000) return 200
  if (range > 500) return 100
  if (range > 200) return 50
  if (range > 80) return 25
  return 10
}

/** Build an array of axis tick years from min..max inclusive. */
function buildTicks(minYear: number, maxYear: number): number[] {
  const step = pickTickStep(maxYear - minYear)
  // Start at the next multiple of `step` ≥ minYear so labels stay round.
  const start = Math.ceil(minYear / step) * step
  const ticks: number[] = []
  for (let y = start; y <= maxYear; y += step) {
    ticks.push(y)
  }
  // Always include year 1 (Hijrah baseline) if it falls in range and
  // isn't already present.
  if (minYear <= 1 && 1 <= maxYear && !ticks.includes(1) && !ticks.includes(0)) {
    ticks.push(1)
    ticks.sort((a, b) => a - b)
  }
  return ticks
}

/**
 * Compute resolved (startAh, endAh) for a figure. Mirrors the fallback
 * logic that was in the previous vis-timeline-based code: a figure with
 * only birth or only death still gets a ±60-year placeholder span so it
 * doesn't disappear from the chart.
 */
function resolveFigureRange(f: TimelineSvgFigure): { startAh: number; endAh: number } | null {
  const birth = typeof f.birthDateAh === 'number' ? f.birthDateAh : null
  const death = typeof f.deathDateAh === 'number' ? f.deathDateAh : null
  if (birth === null && death === null) return null
  const startAh = birth ?? (death as number) - 60
  const endAh = death ?? (birth as number) + 60
  // Guarantee non-zero width — at minimum 1 year so the rect renders.
  if (endAh <= startAh) return { startAh, endAh: startAh + 1 }
  return { startAh, endAh }
}

export function TimelineSvg({
  figures,
  bands = [],
  linkable = true,
  emptyMessage,
}: TimelineSvgProps) {
  const router = useRouter()
  const [hoverId, setHoverId] = useState<string | null>(null)

  // Pre-resolve renderable figures (drop those with no dates at all so
  // we don't allocate an empty row for them).
  const rows = useMemo(() => {
    const out: Array<TimelineSvgFigure & { startAh: number; endAh: number }> = []
    for (const f of figures) {
      const range = resolveFigureRange(f)
      if (!range) continue
      out.push({ ...f, ...range })
    }
    return out
  }, [figures])

  const empty = rows.length === 0

  const [minYear, maxYear] = useMemo<[number, number]>(() => {
    if (empty) return [-60, 740]
    let lo = Infinity
    let hi = -Infinity
    for (const r of rows) {
      if (r.startAh < lo) lo = r.startAh
      if (r.endAh > hi) hi = r.endAh
    }
    // Include event markers so they don't fall outside the plotted area.
    for (const r of rows) {
      for (const e of r.events ?? []) {
        if (e.ah < lo) lo = e.ah
        if (e.ah > hi) hi = e.ah
      }
    }
    // Include bands so background stripes align.
    for (const b of bands) {
      if (b.startAh < lo) lo = b.startAh
      if (b.endAh > hi) hi = b.endAh
    }
    // Pad ~5% on each side so endpoints don't touch the gutter / right
    // edge. Minimum 10 years padding for tiny ranges.
    const range = Math.max(hi - lo, 1)
    const pad = Math.max(Math.round(range * 0.05), 10)
    return [lo - pad, hi + pad]
  }, [rows, bands, empty])

  const ticks = useMemo(() => buildTicks(minYear, maxYear), [minYear, maxYear])

  const svgHeight = empty
    ? PADDING_TOP + PADDING_BOTTOM + 80
    : PADDING_TOP + rows.length * ROW_HEIGHT + PADDING_BOTTOM

  if (empty) {
    return (
      <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
        {emptyMessage ??
          'Belum ada tokoh terpilih, atau data tidak ditemukan. Coba pilih tokoh dari dropdown di atas.'}
      </div>
    )
  }

  // Hijrah baseline (year 1 H, displayed as the "Hijrah" reference line)
  const showHijrahBaseline = minYear <= 1 && maxYear >= 1

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2 sm:p-4">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
          role="img"
          aria-label="Timeline komparasi tokoh"
          className="h-auto w-full"
          style={{ minWidth: '640px' }}
        >
          {/* Background bands (generation stripes etc.) */}
          {bands.map((b, i) => {
            const x1 = yearToX(b.startAh, minYear, maxYear)
            const x2 = yearToX(b.endAh, minYear, maxYear)
            return (
              <g key={`band-${i}`}>
                <rect
                  x={x1}
                  y={PADDING_TOP - 4}
                  width={Math.max(2, x2 - x1)}
                  height={svgHeight - PADDING_TOP - PADDING_BOTTOM + 8}
                  fill={b.fill ?? 'rgb(var(--accent))'}
                  fillOpacity={0.06}
                />
                <text
                  x={x1 + 6}
                  y={PADDING_TOP + 10}
                  fontSize={10}
                  fill="rgb(var(--text-faint))"
                  fontFamily="var(--font-body-latin)"
                >
                  {b.label}
                </text>
              </g>
            )
          })}

          {/* Top axis line */}
          <line
            x1={LABEL_GUTTER}
            y1={PADDING_TOP - 16}
            x2={SVG_WIDTH - PADDING_RIGHT}
            y2={PADDING_TOP - 16}
            stroke="rgb(var(--border))"
            strokeWidth={1}
          />
          {/* Bottom axis line */}
          <line
            x1={LABEL_GUTTER}
            y1={svgHeight - PADDING_BOTTOM + 16}
            x2={SVG_WIDTH - PADDING_RIGHT}
            y2={svgHeight - PADDING_BOTTOM + 16}
            stroke="rgb(var(--border))"
            strokeWidth={1}
          />

          {/* Axis ticks: top = H, bottom = M */}
          {ticks.map((t) => {
            const x = yearToX(t, minYear, maxYear)
            const ce = ahToCe(t)
            return (
              <g key={`tick-${t}`}>
                {/* Top tick mark */}
                <line
                  x1={x}
                  y1={PADDING_TOP - 20}
                  x2={x}
                  y2={PADDING_TOP - 12}
                  stroke="rgb(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={PADDING_TOP - 26}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgb(var(--text-muted))"
                  fontFamily="var(--font-body-latin)"
                >
                  {t < 0 ? `${-t} SH` : `${t} H`}
                </text>
                {/* Bottom tick mark */}
                <line
                  x1={x}
                  y1={svgHeight - PADDING_BOTTOM + 12}
                  x2={x}
                  y2={svgHeight - PADDING_BOTTOM + 20}
                  stroke="rgb(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={svgHeight - PADDING_BOTTOM + 32}
                  textAnchor="middle"
                  fontSize={11}
                  fill="rgb(var(--text-muted))"
                  fontFamily="var(--font-body-latin)"
                >
                  {ce} M
                </text>
              </g>
            )
          })}

          {/* Hijrah baseline (vertical dashed line @ 1 H) */}
          {showHijrahBaseline && (
            <line
              x1={yearToX(1, minYear, maxYear)}
              y1={PADDING_TOP - 16}
              x2={yearToX(1, minYear, maxYear)}
              y2={svgHeight - PADDING_BOTTOM + 16}
              stroke="rgb(var(--accent))"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* Bars */}
          {rows.map((row, i) => {
            const y = PADDING_TOP + i * ROW_HEIGHT
            const x1 = yearToX(row.startAh, minYear, maxYear)
            const x2 = yearToX(row.endAh, minYear, maxYear)
            const barY = y + BAR_OFFSET_Y
            const label = figureLabel(row)
            const isFemale = row.gender === 'female'
            const baseFill = isFemale ? 'rgb(var(--accent))' : 'rgb(var(--primary))'
            const hovered = hoverId === row.id
            const fillOpacity = hovered ? 1 : 0.78

            const tooltip = `${label} — ${formatAhYear(row.birthDateAh)} / ${ahToCe(row.birthDateAh ?? row.startAh)} M – ${formatAhYear(row.deathDateAh)} / ${ahToCe(row.deathDateAh ?? row.endAh)} M`

            const handleClick = () => {
              if (linkable) router.push(`/figures/${row.slug}`)
            }
            const handleKey = (e: ReactKeyboardEvent<SVGGElement>) => {
              if (!linkable) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(`/figures/${row.slug}`)
              }
            }

            return (
              <g
                key={row.id}
                onMouseEnter={() => setHoverId(row.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={handleClick}
                onKeyDown={handleKey}
                tabIndex={linkable ? 0 : -1}
                role={linkable ? 'link' : undefined}
                aria-label={linkable ? `Buka detail ${label}` : undefined}
                style={{ cursor: linkable ? 'pointer' : 'default' }}
              >
                {/* Row separator */}
                {i > 0 && (
                  <line
                    x1={LABEL_GUTTER}
                    y1={y}
                    x2={SVG_WIDTH - PADDING_RIGHT}
                    y2={y}
                    stroke="rgb(var(--border))"
                    strokeOpacity={0.4}
                    strokeWidth={1}
                  />
                )}
                {/* Label (left) */}
                <text
                  x={LABEL_GUTTER - 16}
                  y={y + 20}
                  textAnchor="end"
                  fontSize={13}
                  fontWeight={600}
                  fill="rgb(var(--text))"
                  fontFamily="var(--font-body-latin)"
                >
                  {label}
                </text>
                <text
                  x={LABEL_GUTTER - 16}
                  y={y + 34}
                  textAnchor="end"
                  fontSize={10}
                  fill="rgb(var(--text-muted))"
                  fontFamily="var(--font-body-latin)"
                >
                  {row.categoryLabel ? `${row.categoryLabel} · ` : ''}
                  {formatAhYear(row.birthDateAh)} – {formatAhYear(row.deathDateAh)}
                </text>

                {/* Bar */}
                <rect
                  x={x1}
                  y={barY}
                  width={Math.max(2, x2 - x1)}
                  height={BAR_HEIGHT}
                  rx={4}
                  fill={baseFill}
                  fillOpacity={fillOpacity}
                />
                {/* SVG native tooltip — visible on long hover (browser default). */}
                <title>{tooltip}</title>

                {/* Birth + death endpoint dots */}
                <circle cx={x1} cy={barY + BAR_HEIGHT / 2} r={4} fill={baseFill} />
                <circle
                  cx={x2}
                  cy={barY + BAR_HEIGHT / 2}
                  r={4}
                  fill="rgb(var(--text-muted))"
                />

                {/* Optional highlight markers */}
                {(row.events ?? []).map((e, j) => {
                  const cx = yearToX(e.ah, minYear, maxYear)
                  return (
                    <g key={e.id ?? `${row.id}-evt-${j}`}>
                      <circle cx={cx} cy={barY + BAR_HEIGHT / 2} r={5} fill="rgb(var(--accent))" />
                      <text
                        x={cx + 8}
                        y={barY - 4}
                        fontSize={10}
                        fill="rgb(var(--accent))"
                        fontFamily="var(--font-body-latin)"
                      >
                        {e.label}
                      </text>
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-[rgb(var(--text-muted))]">
        <span>
          <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--primary))]" aria-hidden="true" /> Lahir &nbsp;
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[rgb(var(--text-muted))]" aria-hidden="true" /> Wafat &nbsp;
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[rgb(var(--accent))]" aria-hidden="true" /> Peristiwa
        </span>
        {showHijrahBaseline && (
          <span>Garis putus-putus = 1 H (Hijrah Rasulullah ﷺ ke Madinah)</span>
        )}
      </div>
    </div>
  )
}
