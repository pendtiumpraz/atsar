// Ulama Salaf Plus — multi-generation timeline view (WIREFRAMES §9).
//
// Visualisation strategy:
//   - Use vis-timeline with one *group* per generation (Sahabat,
//     Tabi'in, Tabi'ut Tabi'in, Pasca-Salaf), and each ulama is a single
//     bar/point on its generation lane.  This is a simpler proxy for the
//     full visx + D3 genealogy network described in the wireframe — full
//     network rendering is deferred until we have genealogy edges in the
//     API.
//   - Filters: spesialisasi, madhab — wired as client-side selects that
//     narrow the rendered items.  The list query itself is fixed to fetch
//     the four "ulama-relevant" categories and trim locally.
//   - Region/wilayah filter is deferred: the `figures` table doesn't carry
//     a region column, so filtering would silently drop every row. When
//     the API surfaces `birthLocationId` / `deathLocationId` joins, this
//     filter can come back.
//
// Field naming: figures API returns Drizzle rows verbatim, so keys are
// camelCase (`nameFullId`, `birthDateAh`, `specialty`, `madhab`).
//
// All in one client component so we don't have to thread state.

'use client'

import type { CalendarMode } from '@athar/shared'
import { ahToCe } from '@athar/hijri'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'

import { figuresApi } from '@/lib/api/endpoints'

// Side-effect CSS import — Next handles bundling at build time.
import 'vis-timeline/styles/vis-timeline-graph2d.min.css'

// Figure type — keys mirror the Drizzle row shape the API serialises.
type UlamaFigure = {
  id: string
  slug: string
  nameFullId?: string | null
  nameFullAr?: string | null
  birthDateAh?: number | null
  deathDateAh?: number | null
  // `specialty` is a text[] column on `figures` (e.g. ['hadits','fiqh']).
  specialty?: string[] | null
  // `madhab` is a DB enum: 'shafii' | 'maliki' | 'hanafi' | 'hanbali' |
  // 'zhahiri' | 'no_madhab' (see packages/db schema enums.ts).
  madhab?: string | null
  category?: { slug?: string | null } | null
}

const GENERATION_GROUPS = [
  { id: 'sahabat', label: 'Sahabat' },
  { id: 'tabiin', label: "Tabi'in" },
  { id: 'tabiut_tabiin', label: "Tabi'ut Tabi'in" },
  { id: 'shalih_pasca_rasul', label: 'Pasca-Salaf / Ulama' },
] as const

const SPESIALISASI_OPTIONS = ['Hadits', 'Fiqh', 'Tafsir', 'Aqidah', 'Lughah']

// Madhab options: value matches the DB enum, label is the Indonesian
// display form. Keep these in lock-step with `madhabEnum` in
// packages/db/src/schema/enums.ts.
const MADHAB_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'shafii', label: "Syafi'i" },
  { value: 'maliki', label: 'Maliki' },
  { value: 'hanafi', label: 'Hanafi' },
  { value: 'hanbali', label: 'Hanbali' },
  { value: 'zhahiri', label: 'Zhahiri' },
  { value: 'no_madhab', label: 'Tanpa Madzhab' },
]

export interface UlamaSalafPlusProps {
  mode?: CalendarMode
}

function ahYearToDate(ah: number): Date {
  const ce = ahToCe(ah)
  return new Date(Date.UTC(ce, 0, 1))
}

function figureLabel(f: UlamaFigure): string {
  return f.nameFullId || f.nameFullAr || f.slug
}

function getGenerationGroup(f: UlamaFigure): string | null {
  const slug = f.category?.slug
  if (slug && GENERATION_GROUPS.some((g) => g.id === slug)) return slug
  return null
}

export function UlamaSalafPlus({ mode = 'h' }: UlamaSalafPlusProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const timelineRef = useRef<unknown>(null)

  const [spesialisasi, setSpesialisasi] = useState<string>('')
  const [madhab, setMadhab] = useState<string>('')

  // Fetch the four generation categories in parallel; reuse TanStack cache.
  const queries = useQueries({
    queries: GENERATION_GROUPS.map((g) => ({
      queryKey: ['figures', { category: g.id, perPage: 200 }],
      queryFn: () =>
        figuresApi.list({ category: g.id, perPage: 200 }) as Promise<{ rows: UlamaFigure[] }>,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoading = queries.some((q) => q.isPending)

  const allFigures = useMemo<UlamaFigure[]>(() => {
    const out: UlamaFigure[] = []
    queries.forEach((q, idx) => {
      const generation = GENERATION_GROUPS[idx]!.id
      const rows = (q.data as { rows?: UlamaFigure[] } | undefined)?.rows ?? []
      for (const r of rows) {
        // Inject category slug if the row didn't surface one (defensive —
        // backend usually returns it).
        out.push({
          ...r,
          category: r.category ?? { slug: generation },
        })
      }
    })
    return out
  }, [queries])

  const filtered = useMemo(() => {
    return allFigures.filter((f) => {
      if (spesialisasi) {
        const tags = f.specialty ?? []
        if (!tags.map((t) => t.toLowerCase()).includes(spesialisasi.toLowerCase())) return false
      }
      if (madhab) {
        if ((f.madhab ?? '') !== madhab) return false
      }
      return true
    })
  }, [allFigures, spesialisasi, madhab])

  // Render vis-timeline.  Lazy-import to keep SSR healthy.
  useEffect(() => {
    if (!containerRef.current) return
    if (filtered.length === 0) {
      // Tear down a previous instance so the empty state shows below.
      if (timelineRef.current) {
        try {
          ;(timelineRef.current as { destroy: () => void }).destroy()
        } catch {
          /* noop */
        }
        timelineRef.current = null
      }
      return
    }

    let cancelled = false
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

      const items: Array<Record<string, unknown>> = []
      for (const f of filtered) {
        const group = getGenerationGroup(f)
        if (!group) continue
        const birth = typeof f.birthDateAh === 'number' ? f.birthDateAh : null
        const death = typeof f.deathDateAh === 'number' ? f.deathDateAh : null
        if (birth === null && death === null) continue

        const startAh = birth ?? (death !== null ? death - 60 : 0)
        const endAh = death ?? (birth !== null ? birth + 60 : startAh + 1)

        items.push({
          id: f.id,
          group,
          start: ahYearToDate(startAh),
          end: ahYearToDate(endAh),
          content: figureLabel(f),
          type: 'range',
          title: `${figureLabel(f)} — ${birth ?? '?'}H s/d ${death ?? '?'}H`,
        })
      }

      const groups = GENERATION_GROUPS.map((g) => ({ id: g.id, content: g.label }))

      const options: Record<string, unknown> = {
        stack: true,
        showCurrentTime: false,
        zoomable: true,
        moveable: true,
        horizontalScroll: true,
        orientation: { axis: 'top', item: 'top' },
        margin: { item: 6, axis: 12 },
      }

      if (timelineRef.current) {
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
  }, [filtered, mode])

  return (
    <div className="flex flex-col gap-3">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
        <FilterSelect
          label="Spesialisasi"
          value={spesialisasi}
          onChange={setSpesialisasi}
          options={SPESIALISASI_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
        <FilterSelect
          label="Madzhab"
          value={madhab}
          onChange={setMadhab}
          options={MADHAB_OPTIONS}
        />
        <div className="ml-auto text-xs text-[rgb(var(--text-faint))]">
          {isLoading
            ? 'Memuat tokoh…'
            : `${filtered.length} tokoh tampil`}
        </div>
      </div>

      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2">
        {filtered.length === 0 && !isLoading ? (
          <div className="p-8 text-center text-sm text-[rgb(var(--text-muted))]">
            Tidak ada ulama yang cocok dengan filter saat ini.
          </div>
        ) : (
          <div
            ref={containerRef}
            className="min-h-[28rem] w-full text-sm text-[rgb(var(--text))]"
            aria-label="Timeline ulama salaf"
          />
        )}
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-[rgb(var(--text-muted))]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 min-w-[10rem] rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
      >
        <option value="">Semua {label.toLowerCase()}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
