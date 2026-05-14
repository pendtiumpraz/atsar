// Tab "Timeline" — a per-figure Hijri year axis with birth, death, and
// battle markers. Inspired by `components/marketing/timeline-spoiler.tsx`
// but scaled to a single figure's lifespan.
//
// If we have neither birth nor death AH we fall back to a plain list of
// battles. If we have nothing at all, an empty state is shown.

'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import type { FigureDetailData } from '../figure-detail'

export interface FigureTimelineTabProps {
  data: FigureDetailData
}

const ROW_LABEL_GUTTER = 24
const PADDING_RIGHT = 24
const PADDING_TOP = 60
const PADDING_BOTTOM = 80
const SVG_WIDTH = 880
const AXIS_Y = PADDING_TOP - 24
const BAR_Y = PADDING_TOP + 16
const BAR_HEIGHT = 14

interface AxisRange {
  /** Inclusive low (AH). Negative values = sebelum Hijrah. */
  min: number
  /** Inclusive high (AH). */
  max: number
}

/** Pick a sensible AH window covering birth → death + 10% padding either side. */
function pickRange(data: FigureDetailData): AxisRange | null {
  const events: number[] = []
  if (typeof data.birthDateAh === 'number') events.push(data.birthDateAh)
  if (typeof data.deathDateAh === 'number') events.push(data.deathDateAh)
  for (const b of data.timelineEvents?.battles ?? []) {
    if (typeof b.eventDateAh === 'number') events.push(b.eventDateAh)
  }
  if (events.length === 0) return null
  let min = Math.min(...events)
  let max = Math.max(...events)
  if (min === max) {
    // single point — pad ±5 years so the SVG isn't degenerate.
    min -= 5
    max += 5
  } else {
    const pad = Math.max(2, Math.round((max - min) * 0.1))
    min -= pad
    max += pad
  }
  return { min, max }
}

function yearToX(year: number, range: AxisRange): number {
  const usable = SVG_WIDTH - ROW_LABEL_GUTTER - PADDING_RIGHT
  const span = Math.max(1, range.max - range.min)
  return ROW_LABEL_GUTTER + ((year - range.min) / span) * usable
}

/** Build axis ticks at "nice" intervals (always between 4 and 10 ticks). */
function pickTicks(range: AxisRange): number[] {
  const span = range.max - range.min
  // Find a step in {1,2,5,10,25,50,100,...} that gives ~6 ticks.
  const target = span / 6
  const candidates = [1, 2, 5, 10, 25, 50, 100, 250, 500]
  let step = candidates[candidates.length - 1] as number
  for (const c of candidates) {
    if (c >= target) {
      step = c
      break
    }
  }
  const start = Math.ceil(range.min / step) * step
  const ticks: number[] = []
  for (let v = start; v <= range.max; v += step) {
    ticks.push(v)
  }
  return ticks
}

function formatYearLabel(ah: number): string {
  if (ah < 0) return `${-ah} SH`
  if (ah === 0) return '0 H'
  return `${ah} H`
}

export function FigureTimelineTab({ data }: FigureTimelineTabProps) {
  const range = useMemo(() => pickRange(data), [data])
  const battles = data.timelineEvents?.battles ?? []
  const birthAh = data.birthDateAh ?? data.timelineEvents?.birthAh ?? null
  const deathAh = data.deathDateAh ?? data.timelineEvents?.deathAh ?? null
  const birthCe = data.birthDateCe ?? data.timelineEvents?.birthCe ?? null
  const deathCe = data.deathDateCe ?? data.timelineEvents?.deathCe ?? null

  if (!range) {
    return (
      <EmptyState
        title="Timeline belum tersedia"
        body="Tanggal lahir / wafat tokoh ini belum tercatat. Setelah data ditambahkan, peristiwa hidup akan dipetakan di sumbu waktu ini."
      />
    )
  }

  const ticks = pickTicks(range)
  const x1 = typeof birthAh === 'number' ? yearToX(birthAh, range) : null
  const x2 = typeof deathAh === 'number' ? yearToX(deathAh, range) : null
  const xHijrah = range.min <= 0 && range.max >= 0 ? yearToX(0, range) : null

  // Distribute battle labels onto two staggered rows so adjacent dates don't
  // overlap each other when there are many battles close together.
  const battleEntries = battles
    .filter((b): b is typeof b & { eventDateAh: number } => typeof b.eventDateAh === 'number')

  const svgHeight = PADDING_TOP + 56 + PADDING_BOTTOM

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
          role="img"
          aria-label={`Sumbu waktu hidup ${data.nameFullId ?? data.slug}`}
          className="h-auto w-full"
        >
          {/* Axis line */}
          <line
            x1={ROW_LABEL_GUTTER}
            y1={AXIS_Y}
            x2={SVG_WIDTH - PADDING_RIGHT}
            y2={AXIS_Y}
            stroke="rgb(var(--border))"
            strokeWidth={1}
          />

          {/* Axis ticks */}
          {ticks.map((t) => {
            const x = yearToX(t, range)
            return (
              <g key={t}>
                <line
                  x1={x}
                  y1={AXIS_Y - 4}
                  x2={x}
                  y2={AXIS_Y + 4}
                  stroke="rgb(var(--border))"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={AXIS_Y - 10}
                  textAnchor="middle"
                  fontSize={10}
                  fill="rgb(var(--text-muted))"
                  fontFamily="var(--font-body-latin)"
                >
                  {formatYearLabel(t)}
                </text>
              </g>
            )
          })}

          {/* Hijrah baseline (only when range crosses 0) */}
          {xHijrah !== null ? (
            <g>
              <line
                x1={xHijrah}
                y1={AXIS_Y}
                x2={xHijrah}
                y2={svgHeight - PADDING_BOTTOM}
                stroke="rgb(var(--accent))"
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={xHijrah + 4}
                y={svgHeight - PADDING_BOTTOM + 12}
                fontSize={10}
                fill="rgb(var(--accent))"
                fontFamily="var(--font-body-latin)"
              >
                1 H · Hijrah
              </text>
            </g>
          ) : null}

          {/* Life bar (birth → death) */}
          {x1 !== null && x2 !== null ? (
            <rect
              x={Math.min(x1, x2)}
              y={BAR_Y}
              width={Math.max(2, Math.abs(x2 - x1))}
              height={BAR_HEIGHT}
              rx={4}
              fill="rgb(var(--primary))"
              fillOpacity={0.78}
            />
          ) : null}

          {/* Birth marker */}
          {x1 !== null && typeof birthAh === 'number' ? (
            <g>
              <circle cx={x1} cy={BAR_Y + BAR_HEIGHT / 2} r={5} fill="rgb(var(--primary))" />
              <text
                x={x1}
                y={BAR_Y + BAR_HEIGHT + 14}
                textAnchor="middle"
                fontSize={10}
                fill="rgb(var(--text))"
                fontFamily="var(--font-body-latin)"
              >
                Lahir {formatYearLabel(birthAh)}
                {typeof birthCe === 'number' ? ` (${birthCe} M)` : ''}
              </text>
            </g>
          ) : null}

          {/* Death marker */}
          {x2 !== null && typeof deathAh === 'number' ? (
            <g>
              <circle
                cx={x2}
                cy={BAR_Y + BAR_HEIGHT / 2}
                r={5}
                fill="rgb(var(--text-muted))"
              />
              <text
                x={x2}
                y={BAR_Y + BAR_HEIGHT + 14}
                textAnchor="middle"
                fontSize={10}
                fill="rgb(var(--text))"
                fontFamily="var(--font-body-latin)"
              >
                Wafat {formatYearLabel(deathAh)}
                {typeof deathCe === 'number' ? ` (${deathCe} M)` : ''}
              </text>
            </g>
          ) : null}

          {/* Battle markers */}
          {battleEntries.map((b, idx) => {
            const x = yearToX(b.eventDateAh, range)
            // Stagger labels onto two rows to reduce overlap.
            const labelRow = idx % 2 === 0 ? 0 : 1
            const labelY = BAR_Y + BAR_HEIGHT + 32 + labelRow * 14
            return (
              <g key={b.battleId}>
                <circle cx={x} cy={BAR_Y + BAR_HEIGHT / 2} r={5} fill="rgb(var(--accent))" />
                <line
                  x1={x}
                  y1={BAR_Y + BAR_HEIGHT / 2 + 5}
                  x2={x}
                  y2={labelY - 4}
                  stroke="rgb(var(--accent))"
                  strokeOpacity={0.5}
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={labelY}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgb(var(--accent))"
                  fontFamily="var(--font-body-latin)"
                >
                  {b.nameId} ({formatYearLabel(b.eventDateAh)})
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--primary))]" />
            Lahir
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--text-muted))]" />
            Wafat
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
            Peperangan
          </span>
        </div>
      </div>

      {/* Battle list (link-out) */}
      {battleEntries.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            Ikut serta dalam {battleEntries.length} peperangan
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {battleEntries.map((b) => (
              <li
                key={b.battleId}
                className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm"
              >
                <Link
                  href={`/battles/${b.slug}`}
                  className="font-medium text-[rgb(var(--text))] hover:text-[rgb(var(--primary))]"
                >
                  {b.nameId}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
                  <span>{formatYearLabel(b.eventDateAh)}</span>
                  {typeof b.eventDateCe === 'number' ? <span>· {b.eventDateCe} M</span> : null}
                  <span>· {translateBattleRole(b.role)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function translateBattleRole(role: 'commander' | 'sahabat' | 'fallen' | 'captured'): string {
  switch (role) {
    case 'commander':
      return 'Panglima'
    case 'sahabat':
      return 'Sahabat'
    case 'fallen':
      return 'Gugur'
    case 'captured':
      return 'Tertawan'
  }
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
