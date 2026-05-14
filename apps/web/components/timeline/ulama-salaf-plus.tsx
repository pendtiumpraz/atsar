// Ulama Salaf Plus — multi-generation timeline view (WIREFRAMES §9).
//
// Renders ulama (Tabi'in + Tabi'ut Tabi'in + Pasca-Salaf) on one SVG
// axis with generation-band background stripes. Was previously
// powered by `vis-timeline/standalone`, but that library's DOM-
// mutation model raced with React 19 strict-mode and produced empty-
// canvas symptoms. We now share the renderer at `./timeline-svg.tsx`
// with `/timeline` comparison — modelled after the landing-page
// spoiler.
//
// Filters:
//   - Specialty (hadits / fiqh / tafsir / aqidah / lughah) — text[]
//     column on `figures`.
//   - Madhab — DB enum (shafii, maliki, hanafi, hanbali, zhahiri,
//     no_madhab).
//
// Performance: when N > 30 rows the user must opt into rendering all
// bars via "Tampilkan semua N tokoh" button. Default is first 30 sorted
// by birthDateAh ascending. 200 bars at once is fine on desktop but
// hammers low-end Android.

'use client'

import type { CalendarMode } from '@athar/shared'
import { useQueries } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { figuresApi } from '@/lib/api/endpoints'

import { TimelineSvg, type TimelineSvgBand, type TimelineSvgFigure } from './timeline-svg'

type UlamaFigure = {
  id: string
  slug: string
  nameFullId?: string | null
  nameFullAr?: string | null
  gender?: 'male' | 'female' | null
  birthDateAh?: number | null
  deathDateAh?: number | null
  specialty?: string[] | null
  madhab?: string | null
  category?: { slug?: string | null } | null
}

// The "ulama salaf hingga sekarang" scope per user requirement:
// Tabi'in (1-100H), Tabi'ut Tabi'in (100-200H), Pasca-Salaf (200H+).
// Sahabat lane is excluded here — they belong on /timeline comparison.
const GENERATION_GROUPS = [
  { id: 'tabiin', label: "Tabi'in", startAh: 1, endAh: 100 },
  { id: 'tabiut_tabiin', label: "Tabi'ut Tabi'in", startAh: 100, endAh: 200 },
  { id: 'shalih_pasca_rasul', label: 'Pasca-Salaf / Ulama', startAh: 200, endAh: 1500 },
] as const

const BANDS: TimelineSvgBand[] = GENERATION_GROUPS.map((g, i) => ({
  startAh: g.startAh,
  endAh: g.endAh,
  label: g.label,
  // Alternate band tint for visual rhythm.
  fill: i % 2 === 0 ? 'rgb(var(--accent))' : 'rgb(var(--primary))',
}))

const SPESIALISASI_OPTIONS = ['Hadits', 'Fiqh', 'Tafsir', 'Aqidah', 'Lughah']

const MADHAB_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'shafii', label: "Syafi'i" },
  { value: 'maliki', label: 'Maliki' },
  { value: 'hanafi', label: 'Hanafi' },
  { value: 'hanbali', label: 'Hanbali' },
  { value: 'zhahiri', label: 'Zhahiri' },
  { value: 'no_madhab', label: 'Tanpa Madzhab' },
]

const DEFAULT_PAGE_SIZE = 30

export interface UlamaSalafPlusProps {
  mode?: CalendarMode
}

export function UlamaSalafPlus({ mode: _mode = 'h' }: UlamaSalafPlusProps) {
  const [spesialisasi, setSpesialisasi] = useState<string>('')
  const [madhab, setMadhab] = useState<string>('')
  const [showAll, setShowAll] = useState(false)

  const queries = useQueries({
    queries: GENERATION_GROUPS.map((g) => ({
      queryKey: ['figures', { category: g.id, perPage: 200 }],
      queryFn: () =>
        figuresApi.list({ category: g.id, perPage: 200 }) as Promise<{ rows: UlamaFigure[] }>,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoading = queries.some((q) => q.isPending)

  // Static-length destructure keeps the dep list stable for
  // `react-hooks/exhaustive-deps` (errored in this repo's lint config).
  const [d0, d1, d2] = [queries[0]?.data, queries[1]?.data, queries[2]?.data]
  const allFigures = useMemo<UlamaFigure[]>(() => {
    const out: UlamaFigure[] = []
    const datas = [d0, d1, d2]
    datas.forEach((data, idx) => {
      const rows = (data as { rows?: UlamaFigure[] } | undefined)?.rows ?? []
      const generation = GENERATION_GROUPS[idx]!.id
      for (const r of rows) {
        out.push({ ...r, category: r.category ?? { slug: generation } })
      }
    })
    return out
  }, [d0, d1, d2])

  const filtered = useMemo(() => {
    const list = allFigures.filter((f) => {
      if (spesialisasi) {
        const tags = (f.specialty ?? []).map((t) => t.toLowerCase())
        if (!tags.includes(spesialisasi.toLowerCase())) return false
      }
      if (madhab) {
        if ((f.madhab ?? '') !== madhab) return false
      }
      return true
    })
    // Default sort: by birthDateAh ascending. Figures without
    // birthDateAh fall back to deathDateAh, then to slug as a
    // last-resort tiebreaker so the order is deterministic.
    list.sort((a, b) => {
      const ax = a.birthDateAh ?? a.deathDateAh ?? Number.MAX_SAFE_INTEGER
      const bx = b.birthDateAh ?? b.deathDateAh ?? Number.MAX_SAFE_INTEGER
      if (ax !== bx) return ax - bx
      return a.slug.localeCompare(b.slug)
    })
    return list
  }, [allFigures, spesialisasi, madhab])

  const visible = useMemo(() => {
    if (showAll || filtered.length <= DEFAULT_PAGE_SIZE) return filtered
    return filtered.slice(0, DEFAULT_PAGE_SIZE)
  }, [filtered, showAll])

  // Map to the SVG renderer's input shape.
  const svgFigures = useMemo<TimelineSvgFigure[]>(
    () =>
      visible.map((f) => ({
        id: f.id,
        slug: f.slug,
        nameFullId: f.nameFullId,
        nameFullAr: f.nameFullAr,
        gender: f.gender,
        birthDateAh: f.birthDateAh,
        deathDateAh: f.deathDateAh,
        categoryLabel: GENERATION_GROUPS.find((g) => g.id === f.category?.slug)?.label,
      })),
    [visible],
  )

  const truncated = filtered.length > visible.length

  return (
    <div className="flex flex-col gap-3">
      {/* Filter row */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
        <FilterSelect
          label="Spesialisasi"
          value={spesialisasi}
          onChange={(v) => {
            setSpesialisasi(v)
            setShowAll(false)
          }}
          options={SPESIALISASI_OPTIONS.map((o) => ({ value: o, label: o }))}
        />
        <FilterSelect
          label="Madzhab"
          value={madhab}
          onChange={(v) => {
            setMadhab(v)
            setShowAll(false)
          }}
          options={MADHAB_OPTIONS}
        />
        <div className="ml-auto text-xs text-[rgb(var(--text-faint))]">
          {isLoading
            ? 'Memuat tokoh…'
            : `${visible.length}${truncated ? ` / ${filtered.length}` : ''} tokoh tampil`}
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center text-sm text-[rgb(var(--text-muted))]">
          Tidak ada ulama yang cocok dengan filter saat ini.
        </div>
      ) : (
        <>
          <TimelineSvg figures={svgFigures} bands={BANDS} />
          {truncated && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-2 text-sm font-medium text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]"
              >
                Tampilkan semua {filtered.length} tokoh
              </button>
            </div>
          )}
        </>
      )}
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
