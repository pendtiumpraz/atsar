// Cascading multi-select for the comparison timeline (WIREFRAMES §8,
// IDEAS §2.1).
//
// Behaviour:
//   - User picks up to 5 figures.  Selection is mirrored to the URL as
//     `?ids=a,b,c` so deep-linking works (and the server `/timeline`
//     page can SSR the initial render).
//   - Cascading: after a sahabat is picked, the tabi'in dropdown is
//     filtered to those whose `birth_date_ah > selectedRef.death_date_ah`
//     (i.e. lived after the reference figure died).  Same idea for
//     tabi'ut tabi'in after a tabi'in pick.
//   - Lazy fetch: each list comes from `figuresApi.list({ category })`
//     via TanStack Query — fetches are memoised so flipping between
//     dropdowns doesn't refetch.

'use client'

import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { figuresApi, type Paginated } from '@/lib/api/endpoints'

const MAX_FIGURES = 5

type ApiFigure = {
  id: string
  slug: string
  name_full_id?: string | null
  name_full_ar?: string | null
  gender?: 'male' | 'female' | null
  birth_date_ah?: number | null
  death_date_ah?: number | null
}

export interface ComparisonPickerProps {
  /**
   * Optional preselected figure IDs (read from URL by the server page).
   * The picker keeps URL + local state in sync.
   */
  initialIds?: string[]
  /**
   * Notify parent of selected ids — passed to <TimelineComparison /> by the
   * client wrapper.  Optional because URL is the source of truth.
   */
  onChange?: (ids: string[]) => void
}

function useFigures(category: string) {
  return useQuery<Paginated<ApiFigure>>({
    queryKey: ['figures', { category, perPage: 200 }],
    queryFn: () =>
      figuresApi.list({ category, perPage: 200 }) as Promise<Paginated<ApiFigure>>,
    staleTime: 5 * 60 * 1000,
  })
}

function pushIdsToUrl(
  router: ReturnType<typeof useRouter>,
  sp: URLSearchParams,
  ids: string[],
) {
  const next = new URLSearchParams(sp.toString())
  if (ids.length > 0) next.set('ids', ids.join(','))
  else next.delete('ids')
  const qs = next.toString()
  router.replace(qs ? `?${qs}` : '?', { scroll: false })
}

export function ComparisonPicker({ initialIds = [], onChange }: ComparisonPickerProps) {
  const router = useRouter()
  const sp = useSearchParams()
  const urlIds = useMemo(() => {
    const raw = sp.get('ids')
    if (!raw) return [] as string[]
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }, [sp])

  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialIds.length > 0 ? initialIds : urlIds,
  )

  // Sync URL → local when user uses back/forward.
  useEffect(() => {
    setSelectedIds(urlIds)
  }, [urlIds])

  // Surface to parent for the timeline rendering.
  useEffect(() => {
    onChange?.(selectedIds)
  }, [selectedIds, onChange])

  const sahabat = useFigures('sahabat')
  const tabiin = useFigures('tabiin')
  const tabiutTabiin = useFigures('tabiut-tabiin')

  // Build a quick id→figure lookup so the chips can show names without
  // chasing the dropdowns.
  const allFigures = useMemo<ApiFigure[]>(() => {
    return [
      ...(sahabat.data?.rows ?? []),
      ...(tabiin.data?.rows ?? []),
      ...(tabiutTabiin.data?.rows ?? []),
    ]
  }, [sahabat.data, tabiin.data, tabiutTabiin.data])

  const byId = useMemo(() => {
    const m = new Map<string, ApiFigure>()
    for (const f of allFigures) m.set(f.id, f)
    return m
  }, [allFigures])

  // Reference figure (latest selected) → used to filter the next-tier
  // dropdown.  Cascading per IDEAS §2.1.
  const referenceDeathAh = useMemo<number | null>(() => {
    for (let i = selectedIds.length - 1; i >= 0; i -= 1) {
      const f = byId.get(selectedIds[i] as string)
      if (f && typeof f.death_date_ah === 'number') return f.death_date_ah
    }
    return null
  }, [selectedIds, byId])

  const filteredTabiin = useMemo(() => {
    const rows = tabiin.data?.rows ?? []
    if (referenceDeathAh === null) return rows
    return rows.filter(
      (f) => typeof f.birth_date_ah === 'number' && f.birth_date_ah > referenceDeathAh,
    )
  }, [tabiin.data, referenceDeathAh])

  const filteredTabiut = useMemo(() => {
    const rows = tabiutTabiin.data?.rows ?? []
    if (referenceDeathAh === null) return rows
    return rows.filter(
      (f) => typeof f.birth_date_ah === 'number' && f.birth_date_ah > referenceDeathAh,
    )
  }, [tabiutTabiin.data, referenceDeathAh])

  function addId(id: string) {
    if (!id) return
    if (selectedIds.includes(id)) return
    if (selectedIds.length >= MAX_FIGURES) return
    const next = [...selectedIds, id]
    setSelectedIds(next)
    pushIdsToUrl(router, sp, next)
  }

  function removeId(id: string) {
    const next = selectedIds.filter((x) => x !== id)
    setSelectedIds(next)
    pushIdsToUrl(router, sp, next)
  }

  const atLimit = selectedIds.length >= MAX_FIGURES

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[rgb(var(--text))]">
          Pilih Tokoh ({selectedIds.length}/{MAX_FIGURES})
        </span>
        {referenceDeathAh !== null ? (
          <span className="text-xs text-[rgb(var(--text-faint))]">
            Filter: hidup setelah {referenceDeathAh}H
          </span>
        ) : null}
      </div>

      {/* Chips */}
      <ul className="flex flex-wrap gap-2">
        {selectedIds.length === 0 ? (
          <li className="text-xs text-[rgb(var(--text-muted))]">Belum ada pilihan.</li>
        ) : null}
        {selectedIds.map((id) => {
          const f = byId.get(id)
          const label = f ? f.name_full_id || f.name_full_ar || f.slug : id
          return (
            <li
              key={id}
              className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-2 py-1 text-xs text-[rgb(var(--text))]"
            >
              <span>{label}</span>
              <button
                type="button"
                aria-label={`Hapus ${label}`}
                onClick={() => removeId(id)}
                className="text-[rgb(var(--text-muted))] hover:text-[rgb(var(--danger))]"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>

      {/* Cascading dropdowns */}
      <div className="grid gap-2 sm:grid-cols-3">
        <CategorySelect
          label="Sahabat"
          options={sahabat.data?.rows ?? []}
          disabled={atLimit || sahabat.isPending}
          onPick={addId}
          excludeIds={selectedIds}
        />
        <CategorySelect
          label="Tabi'in"
          options={filteredTabiin}
          disabled={atLimit || tabiin.isPending}
          onPick={addId}
          excludeIds={selectedIds}
        />
        <CategorySelect
          label="Tabi'ut Tabi'in"
          options={filteredTabiut}
          disabled={atLimit || tabiutTabiin.isPending}
          onPick={addId}
          excludeIds={selectedIds}
        />
      </div>
    </div>
  )
}

function CategorySelect({
  label,
  options,
  disabled,
  excludeIds,
  onPick,
}: {
  label: string
  options: ApiFigure[]
  disabled?: boolean
  excludeIds: string[]
  onPick: (id: string) => void
}) {
  const exclude = new Set(excludeIds)
  return (
    <label className="flex flex-col gap-1 text-xs text-[rgb(var(--text-muted))]">
      <span>{label}</span>
      <select
        disabled={disabled}
        value=""
        onChange={(e) => {
          const v = e.target.value
          if (v) onPick(v)
          // Reset so the same option can be re-picked later if removed.
          e.target.value = ''
        }}
        className="h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] disabled:opacity-50"
      >
        <option value="">
          {disabled ? 'Tidak tersedia' : `Pilih ${label.toLowerCase()}…`}
        </option>
        {options
          .filter((f) => !exclude.has(f.id))
          .map((f) => (
            <option key={f.id} value={f.id}>
              {f.name_full_id || f.name_full_ar || f.slug}
              {typeof f.death_date_ah === 'number' ? ` (w. ${f.death_date_ah}H)` : ''}
            </option>
          ))}
      </select>
    </label>
  )
}
