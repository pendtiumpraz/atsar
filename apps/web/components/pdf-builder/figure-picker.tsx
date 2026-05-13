// Step 1 of the PDF builder wizard — multi-select figure picker.
//
// - Left pane: searchable, paginated list (`figuresApi.list`) using TanStack
//   Query with `keepPreviousData` so typing in the search box doesn't blank
//   the list.
// - Right pane: chips for currently selected figures (removable). The count
//   gate (2…60) is enforced visually here and again at submit time.
//
// Selection lives in the parent wizard so navigating between steps preserves
// state. We accept `selected` + `onChange` props and treat them as the source
// of truth — never mirror them in local state.

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { figuresApi, type Paginated } from '@/lib/api/endpoints'

export interface PickerFigure {
  id: string
  slug: string
  nameShortId?: string | null
  nameFullId?: string | null
  nameShortAr?: string | null
  nameFullAr?: string | null
  gender?: 'male' | 'female' | null
  category?: { nameId?: string | null; slug?: string } | null
}

export interface FigurePickerProps {
  selected: PickerFigure[]
  onChange: (next: PickerFigure[]) => void
  /** Inclusive lower bound (default 2). */
  min?: number
  /** Inclusive upper bound (default 60). */
  max?: number
}

function latinName(f: PickerFigure): string {
  return f.nameShortId ?? f.nameFullId ?? f.slug
}

function arabicName(f: PickerFigure): string | null {
  return f.nameShortAr ?? f.nameFullAr ?? null
}

export function FigurePicker({
  selected,
  onChange,
  min = 2,
  max = 60,
}: FigurePickerProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const params = useMemo(
    () => ({
      q: search.trim() || undefined,
      page,
      perPage: 20,
    }),
    [search, page],
  )

  const { data, isPending, isError } = useQuery<Paginated<PickerFigure>>({
    queryKey: ['pdf-builder', 'figures', params],
    queryFn: () => figuresApi.list(params) as Promise<Paginated<PickerFigure>>,
    placeholderData: keepPreviousData,
  })

  // Build an id-set so toggling stays O(1) regardless of selection length.
  const selectedIds = useMemo(() => new Set(selected.map((f) => f.id)), [selected])

  function toggle(figure: PickerFigure) {
    if (selectedIds.has(figure.id)) {
      onChange(selected.filter((f) => f.id !== figure.id))
      return
    }
    if (selected.length >= max) return // hard-cap; the row checkbox is disabled too.
    onChange([...selected, figure])
  }

  function remove(id: string) {
    onChange(selected.filter((f) => f.id !== id))
  }

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const perPage = data?.perPage ?? 20
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const atMax = selected.length >= max
  const belowMin = selected.length < min

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      {/* List pane */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-faint))]"
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Cari tokoh..."
            className="pl-9"
            aria-label="Cari tokoh"
          />
        </div>

        {isPending ? (
          <PickerSkeleton />
        ) : isError ? (
          <div
            role="alert"
            className="rounded-lg border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-4 text-sm text-[rgb(var(--danger))]"
          >
            Gagal memuat daftar tokoh.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center text-sm text-[rgb(var(--text-muted))]">
            Tidak ada tokoh ditemukan.
          </div>
        ) : (
          <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1">
            {rows.map((figure) => {
              const checked = selectedIds.has(figure.id)
              const disabled = !checked && atMax
              return (
                <li key={figure.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2.5 text-sm transition-colors hover:bg-[rgb(var(--bg-elevated))] ${
                      disabled ? 'opacity-50' : ''
                    } ${checked ? 'border-[rgb(var(--accent))]' : ''}`}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={() => toggle(figure)}
                      aria-label={`Pilih ${latinName(figure)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-[rgb(var(--text))]">
                        {latinName(figure)}
                      </div>
                      {arabicName(figure) ? (
                        <div
                          lang="ar"
                          dir="rtl"
                          className="truncate text-sm text-[rgb(var(--text-muted))]"
                          style={{ fontFamily: 'var(--font-body-arab)' }}
                        >
                          {arabicName(figure)}
                        </div>
                      ) : null}
                    </div>
                    {figure.category?.nameId ? (
                      <Badge variant="secondary" className="shrink-0 px-2 py-0">
                        {figure.category.nameId}
                      </Badge>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 text-xs text-[rgb(var(--text-muted))]">
            <span>
              Halaman {page} / {totalPages} · {total} tokoh
            </span>
            <div className="flex gap-1">
              <Button
                size="xs"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Sebelumnya
              </Button>
              <Button
                size="xs"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Selection pane */}
      <aside className="flex flex-col gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
        <header className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[rgb(var(--text))]">Dipilih</h3>
          <span
            className={`text-xs ${
              atMax
                ? 'text-[rgb(var(--warning))]'
                : belowMin
                  ? 'text-[rgb(var(--text-muted))]'
                  : 'text-[rgb(var(--success))]'
            }`}
            aria-live="polite"
          >
            {selected.length} / {max} (min {min})
          </span>
        </header>
        {selected.length === 0 ? (
          <p className="rounded-md border border-dashed border-[rgb(var(--border))] p-3 text-xs text-[rgb(var(--text-muted))]">
            Pilih minimal {min} tokoh untuk melanjutkan.
          </p>
        ) : (
          <ul className="flex max-h-[24rem] flex-col gap-1 overflow-y-auto">
            {selected.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between gap-2 rounded-md bg-[rgb(var(--bg-elevated))] px-2 py-1.5 text-xs"
              >
                <span className="truncate">{latinName(f)}</span>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  className="rounded p-0.5 text-[rgb(var(--text-faint))] hover:bg-[rgb(var(--border))] hover:text-[rgb(var(--danger))]"
                  aria-label={`Hapus ${latinName(f)}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

function PickerSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="h-12 animate-pulse rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
        />
      ))}
    </div>
  )
}
