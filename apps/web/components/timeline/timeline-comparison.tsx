// Multi-tokoh comparison timeline (WIREFRAMES §8).
//
// Renders the picker's selection as a clean SVG range-bar chart with
// dual H/M axis. Was previously powered by `vis-timeline/standalone`,
// but that library mutates DOM imperatively and had repeated empty-
// canvas symptoms on prod (race with React 19 strict-mode). The
// landing-page spoiler at `components/marketing/timeline-spoiler.tsx`
// uses pure SVG and has worked since day one — we adopt that pattern
// here. Shared renderer lives in `./timeline-svg.tsx`.
//
// State for the comparison still lives in the URL (`?ids=a,b,c`). The
// `<ComparisonTimelineView>` wrapper reads `?ids` via
// `useSearchParams`, fetches all six canonical figure categories, and
// hands a flat `ComparisonFigure[]` to the SVG renderer.

'use client'

import type { CalendarMode } from '@athar/shared'
import { useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { figuresApi } from '@/lib/api/endpoints'

import { TimelineSvg, type TimelineSvgFigure } from './timeline-svg'

export interface ComparisonFigure {
  id: string
  slug: string
  // Field naming: API serialises Drizzle rows verbatim — camelCase, never
  // snake_case. Sticking with snake_case here would silently leave the
  // timeline empty because every per-figure read below would be undefined.
  nameFullId?: string | null
  nameFullAr?: string | null
  gender?: 'male' | 'female' | null
  birthDateAh?: number | null
  deathDateAh?: number | null
  /** Optional point markers (bi'tsah, masuk Islam, etc). */
  events?: Array<{ id?: string; ah: number; label: string }>
}

export interface TimelineComparisonProps {
  figures: ComparisonFigure[]
  /** Reserved for future single/dual axis toggle. SVG renderer always shows H + M. */
  mode?: CalendarMode
}

export function TimelineComparison({ figures }: TimelineComparisonProps) {
  // Map to the renderer's input shape — they're structurally compatible
  // but the explicit conversion documents the contract.
  const rows: TimelineSvgFigure[] = useMemo(
    () =>
      figures.map((f) => ({
        id: f.id,
        slug: f.slug,
        nameFullId: f.nameFullId,
        nameFullAr: f.nameFullAr,
        gender: f.gender,
        birthDateAh: f.birthDateAh,
        deathDateAh: f.deathDateAh,
        events: f.events,
      })),
    [figures],
  )

  return (
    <TimelineSvg
      figures={rows}
      emptyMessage="Belum ada tokoh terpilih, atau data tidak ditemukan. Coba pilih tokoh dari dropdown di atas."
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────
// URL-driven wrapper
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convenience wrapper used by the `/timeline` server page. Reads
 * `?ids=a,b,c` from the URL, fetches each figure id, and renders the
 * SVG timeline.
 *
 * IMPORTANT: load *all six* canonical figure categories. The picker
 * only writes ids from sahabat/tabiin/tabiut_tabiin, but a viewer can
 * deep-link any id through `?ids=`. If a passed id belongs to e.g.
 * `shalih_pasca_rasul` (modern ulama) or `shalih_pre_rasul` (pre-
 * Islamic righteous), it would otherwise miss every lookup below and
 * silently produce an empty `figures` array → empty canvas.
 */
export interface ComparisonTimelineViewProps {
  /** Calendar display mode. Currently informational — SVG always renders dual H+M. */
  mode?: CalendarMode
}

export function ComparisonTimelineView({ mode = 'h' }: ComparisonTimelineViewProps) {
  const sp = useSearchParams()
  const idsParam = sp.get('ids') ?? ''
  const ids = useMemo(
    () =>
      idsParam
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    [idsParam],
  )

  const cats = useQueries({
    queries: [
      { queryKey: ['figures', { category: 'sahabat', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'sahabat', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'tabiin', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'tabiin', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'tabiut_tabiin', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'tabiut_tabiin', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'nabi', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'nabi', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'shalih_pre_rasul', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'shalih_pre_rasul', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'shalih_pasca_rasul', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'shalih_pasca_rasul', perPage: 200 }), staleTime: 5 * 60 * 1000 },
    ],
  })

  // Pluck out the six data refs by index. The fixed-length destructure
  // makes the dep list static so `react-hooks/exhaustive-deps` (errored
  // in this repo's lint config) stays satisfied — passing the dynamic
  // `cats` array directly trips the rule.
  const [d0, d1, d2, d3, d4, d5] = [
    cats[0]?.data,
    cats[1]?.data,
    cats[2]?.data,
    cats[3]?.data,
    cats[4]?.data,
    cats[5]?.data,
  ]
  const allRows = useMemo<ComparisonFigure[]>(() => {
    const out: ComparisonFigure[] = []
    for (const data of [d0, d1, d2, d3, d4, d5]) {
      const d = data as { rows?: ComparisonFigure[] } | undefined
      if (d?.rows) out.push(...d.rows)
    }
    return out
  }, [d0, d1, d2, d3, d4, d5])

  const figures = useMemo(() => {
    if (ids.length === 0) return []
    const byId = new Map<string, ComparisonFigure>()
    for (const f of allRows) byId.set(f.id, f)
    return ids
      .map((id) => {
        const hit = byId.get(id)
        if (!hit && allRows.length > 0) {
          // All category queries have responded with at least one row
          // but the id is still missing — surface so Vercel runtime
          // logs catch silent gaps.
          console.error('[timeline] figure lookup miss', id)
        }
        return hit
      })
      .filter((x): x is ComparisonFigure => x !== undefined)
  }, [ids, allRows])

  // Avoid hydration mismatch — empty state on initial render is fine.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])

  const anyLoading = cats.some((q) => q.isPending)

  if (!hydrated) {
    return (
      <div className="min-h-[24rem] rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))]" />
    )
  }

  if (ids.length > 0 && anyLoading && figures.length === 0) {
    return (
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Memuat data tokoh…
      </div>
    )
  }

  return <TimelineComparison figures={figures} mode={mode} />
}
