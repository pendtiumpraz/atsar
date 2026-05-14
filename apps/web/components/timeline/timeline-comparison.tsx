// Multi-tokoh comparison timeline (WIREFRAMES §8).
//
// Wraps `vis-timeline` in a React-friendly component.  Each figure becomes
// its own *group* (lane), and renders as a single bar spanning
// `birth_date_ah → death_date_ah`.  When a figure exposes `events`, those
// are rendered as point items overlaid on the same group.
//
// `vis-timeline` is imperative (it mutates the DOM directly) so we keep the
// canonical state in refs and rebuild the dataset whenever the `figures`
// prop changes.  We never mount more than one Timeline instance — destroy
// + recreate on prop change keeps `useEffect` cleanup honest.
//
// AH → JS-Date approximation:
//   - vis-timeline's axis only understands JS Dates.  We project AH years
//     onto a synthetic calendar using `ahToCe` from `@athar/hijri` so the
//     axis labels (when mode='m') line up with real CE years; otherwise we
//     overlay an H-only formatter via `format.minorLabels`.

'use client'

import type { CalendarMode } from '@athar/shared'
import { ahToCe } from '@athar/hijri'
import { useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { figuresApi } from '@/lib/api/endpoints'

// vis-timeline ships its CSS as a separate file.  Static side-effect
// import lets Next's CSS pipeline pick it up at build time without
// blowing up the server build (CSS imports are safe in 'use client'
// modules).
import 'vis-timeline/styles/vis-timeline-graph2d.min.css'

export interface ComparisonFigure {
  id: string
  slug: string
  name_full_id?: string | null
  name_full_ar?: string | null
  gender?: 'male' | 'female' | null
  birth_date_ah?: number | null
  death_date_ah?: number | null
  /**
   * Optional point markers (e.g. bi'tsah, masuk Islam).  Each event must
   * carry an AH year — we project to a JS Date in the same way as the
   * birth/death range.
   */
  events?: Array<{ id?: string; ah: number; label: string }>
}

export interface TimelineComparisonProps {
  figures: ComparisonFigure[]
  mode: CalendarMode
}

/**
 * Convert an AH year (possibly negative for SH) to a JS Date sortable by
 * vis-timeline.  We use the hijri converter so M-mode axis labels line up
 * with real CE years; for H-only mode we still need a Date object but the
 * custom formatter renders AH on top.
 */
function ahYearToDate(ah: number): Date {
  // Treat the first day of the AH year as Jan 1 of the corresponding CE year.
  // Good enough for year-only data — full month/day precision is out of
  // scope here (figure data only has year granularity).
  const ce = ahToCe(ah)
  return new Date(Date.UTC(ce, 0, 1))
}

/** Inverse: best-effort CE→AH for axis tick labels. */
function dateToAhLabel(date: Date): number {
  const ce = date.getUTCFullYear()
  // Inline the conversion from packages/hijri (mirror of ceToAh).
  return Math.round(((ce - 622) * 365.2425) / 354.367)
}

function figureLabel(f: ComparisonFigure): string {
  return f.name_full_id || f.name_full_ar || f.slug
}

export function TimelineComparison({ figures, mode }: TimelineComparisonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  // Hold the Timeline so we can destroy it on cleanup or rebuild.
  const timelineRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (figures.length === 0) return

    let cancelled = false

    // `vis-timeline/standalone` ships a heavy bundle (and CSS) — only load
    // on the client.  Dynamic import keeps SSR happy and avoids the
    // "self is not defined" error on Node.
    void (async () => {
      const visModule = await import('vis-timeline/standalone')
      if (cancelled || !containerRef.current) return

      const { Timeline, DataSet } = visModule as unknown as {
        Timeline: new (
          container: HTMLElement,
          items: unknown,
          groups: unknown,
          options: Record<string, unknown>,
        ) => { destroy: () => void; setOptions: (o: Record<string, unknown>) => void }
        DataSet: new (rows: unknown[]) => unknown
      }

      // Items: one range bar per figure + optional event points.
      const items: Array<Record<string, unknown>> = []
      for (const f of figures) {
        const birth = typeof f.birth_date_ah === 'number' ? f.birth_date_ah : null
        const death = typeof f.death_date_ah === 'number' ? f.death_date_ah : null
        if (birth === null && death === null) continue

        const startAh = birth ?? (death !== null ? death - 60 : 0)
        const endAh = death ?? (birth !== null ? birth + 60 : startAh + 1)

        items.push({
          id: f.id,
          group: f.id,
          start: ahYearToDate(startAh),
          end: ahYearToDate(endAh),
          content: figureLabel(f),
          type: 'range',
          className:
            f.gender === 'female' ? 'athar-timeline-female' : 'athar-timeline-male',
          title: `${figureLabel(f)} — ${birth ?? '?'}H s/d ${death ?? '?'}H`,
        })

        if (f.events) {
          for (const evt of f.events) {
            items.push({
              id: `${f.id}:${evt.id ?? evt.ah}`,
              group: f.id,
              start: ahYearToDate(evt.ah),
              content: evt.label,
              type: 'point',
              title: `${evt.label} (${evt.ah}H)`,
            })
          }
        }
      }

      const groups = figures.map((f) => ({
        id: f.id,
        content: figureLabel(f),
      }))

      // Axis formatter: render H labels when mode != 'm'.  We piggy-back on
      // the year-granularity tick and override its text content.
      const yearFormatter = (date: Date) => {
        const ah = dateToAhLabel(date)
        const ce = date.getUTCFullYear()
        if (mode === 'h') return `${ah}H`
        if (mode === 'm') return `${ce}M`
        return `${ah}H / ${ce}M`
      }

      const options: Record<string, unknown> = {
        stack: false,
        showCurrentTime: false,
        zoomable: true,
        moveable: true,
        horizontalScroll: true,
        orientation: { axis: 'top', item: 'top' },
        margin: { item: 8, axis: 12 },
        format: {
          minorLabels: { year: 'yyyy' },
          majorLabels: { year: '' },
        },
      }

      if (containerRef.current && timelineRef.current) {
        // Destroy previous instance before rebuilding so we don't stack
        // multiple DOM trees inside the same container.
        try {
          ;(timelineRef.current as { destroy: () => void }).destroy()
        } catch {
          /* noop */
        }
        timelineRef.current = null
      }

      const timeline = new Timeline(
        containerRef.current,
        new DataSet(items),
        new DataSet(groups),
        options,
      )
      timelineRef.current = timeline

      // Custom axis tick formatting — vis-timeline ships a hook
      // (`format.minorLabels` as a function), but the typed API is loose,
      // so we use `setOptions` for the function variant.
      try {
        timeline.setOptions({
          format: {
            minorLabels: (date: Date) => yearFormatter(date),
          },
        })
      } catch {
        /* tolerated — older API just keeps yyyy label */
      }
    })()

    return () => {
      cancelled = true
      if (timelineRef.current) {
        try {
          ;(timelineRef.current as { destroy: () => void }).destroy()
        } catch {
          /* noop */
        }
        timelineRef.current = null
      }
    }
  }, [figures, mode])

  if (figures.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Pilih tokoh di atas untuk memulai komparasi.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2">
      <div
        ref={containerRef}
        className="min-h-[24rem] w-full text-sm text-[rgb(var(--text))]"
        aria-label="Timeline komparasi tokoh"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// URL-driven wrapper
// ─────────────────────────────────────────────────────────────────────────

/**
 * Convenience wrapper used by the `/timeline` server page.  Reads
 * `?ids=a,b,c` from the URL, fetches each figure by slug (we treat the
 * id-list as slugs because the picker writes API ids — but for SSR
 * deep-links the page author can pass slugs too; both round-trip the
 * `figuresApi.list` cache), and renders the timeline.
 *
 * The picker mutates the URL — this component reacts.  Keeping the two
 * loosely coupled via the URL lets the server page hydrate without a
 * shared store.
 */
export interface ComparisonTimelineViewProps {
  /** Calendar display mode (currently fixed to 'h' — picker for mode lives in P5-1). */
  mode?: CalendarMode
}

export function ComparisonTimelineView({ mode = 'h' }: ComparisonTimelineViewProps) {
  const sp = useSearchParams()
  const idsParam = sp.get('ids') ?? ''
  const ids = useMemo(
    () => idsParam.split(',').map((s) => s.trim()).filter((s) => s.length > 0),
    [idsParam],
  )

  // We can't fetch by id directly with the current endpoint surface — but
  // `figuresApi.list` returns all rows so we can match client-side.  Cache
  // is shared with the picker (same query key).
  const cats = useQueries({
    queries: [
      { queryKey: ['figures', { category: 'sahabat', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'sahabat', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'tabiin', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'tabiin', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'tabiut_tabiin', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'tabiut_tabiin', perPage: 200 }), staleTime: 5 * 60 * 1000 },
      { queryKey: ['figures', { category: 'nabi', perPage: 200 }], queryFn: () => figuresApi.list({ category: 'nabi', perPage: 200 }), staleTime: 5 * 60 * 1000 },
    ],
  })

  const allRows = useMemo<ComparisonFigure[]>(() => {
    const out: ComparisonFigure[] = []
    for (const q of cats) {
      const data = q.data as { rows?: ComparisonFigure[] } | undefined
      if (data?.rows) out.push(...data.rows)
    }
    return out
  }, [cats])

  const figures = useMemo(() => {
    if (ids.length === 0) return []
    const byId = new Map<string, ComparisonFigure>()
    for (const f of allRows) byId.set(f.id, f)
    return ids.map((id) => byId.get(id)).filter((x): x is ComparisonFigure => x !== undefined)
  }, [ids, allRows])

  // Avoid hydration mismatch — empty state on initial render is fine since
  // figure rows arrive async.  We still surface a loading hint.
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
