// `<FigureAutocomplete />` — debounced search-as-you-type combobox for picking
// a figure by name (Indonesian or Arabic). Used by the relations panel of
// the figure edit form when admin needs to point at the target figure.
//
// Behaviour:
//   - 300ms debounce, fires GET /api/v1/figures?q=… (FTS + ILIKE on the backend).
//   - Top 10 matches.
//   - Keyboard: ArrowUp / ArrowDown / Enter / Escape.
//   - Excludes any slug in `excludeSlugs` (typically the figure being edited).
//
// Renders as a controlled component: parent owns `value` (a `FigureOption`
// or `null`). Picking a row calls `onChange(option)`. Clearing calls
// `onChange(null)`.

'use client'

import * as React from 'react'
import { Loader2, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { apiPaginated } from '@/lib/api/client'

export interface FigureOption {
  id: string
  slug: string
  nameFullId: string
  nameFullAr: string | null
  nameShortId: string | null
}

export interface FigureAutocompleteProps {
  /** Currently selected figure (or null). */
  value: FigureOption | null
  onChange: (next: FigureOption | null) => void
  /** Slugs to hide from the suggestion list (typically the figure being edited). */
  excludeSlugs?: string[]
  placeholder?: string
  id?: string
  /** Marks the input invalid for accessibility / styling. */
  invalid?: boolean
  disabled?: boolean
}

const DEBOUNCE_MS = 300
const MAX_RESULTS = 10

// Loose row shape — the figures list endpoint returns the full DB row but we
// only care about a few columns here.
interface FigureRow {
  id: string
  slug: string
  nameFullId: string
  nameFullAr: string | null
  nameShortId: string | null
}

export function FigureAutocomplete({
  value,
  onChange,
  excludeSlugs = [],
  placeholder = 'Cari tokoh…',
  id,
  invalid = false,
  disabled = false,
}: FigureAutocompleteProps) {
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [options, setOptions] = React.useState<FigureOption[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // ─── Debounce query ──────────────────────────────────────────────────
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // ─── Fetch suggestions ───────────────────────────────────────────────
  React.useEffect(() => {
    if (debounced.length < 2) {
      setOptions([])
      return
    }
    let cancelled = false
    setLoading(true)
    apiPaginated<FigureRow>(`/figures?q=${encodeURIComponent(debounced)}&perPage=${MAX_RESULTS}`)
      .then((res) => {
        if (cancelled) return
        const filtered = (res.rows ?? [])
          .filter((r) => !excludeSlugs.includes(r.slug))
          .slice(0, MAX_RESULTS)
          .map<FigureOption>((r) => ({
            id: r.id,
            slug: r.slug,
            nameFullId: r.nameFullId,
            nameFullAr: r.nameFullAr,
            nameShortId: r.nameShortId,
          }))
        setOptions(filtered)
        setHighlight(0)
      })
      .catch(() => {
        if (cancelled) return
        setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, excludeSlugs])

  // ─── Click-outside closes the popover ─────────────────────────────────
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(opt: FigureOption) {
    onChange(opt)
    setQuery('')
    setOpen(false)
    setOptions([])
  }

  function clear() {
    onChange(null)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (options[highlight]) {
        e.preventDefault()
        pick(options[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  // When a value is selected, render a "chip" instead of the input.
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-[rgb(var(--text))]">
            {value.nameShortId || value.nameFullId}
          </span>
          {value.nameFullAr ? (
            <span
              dir="rtl"
              lang="ar"
              className="truncate text-xs text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {value.nameFullAr}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label="Hapus pilihan tokoh"
          disabled={disabled}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface))] hover:text-[rgb(var(--danger))]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-invalid={invalid ? 'true' : 'false'}
        aria-autocomplete="list"
        aria-expanded={open}
        autoComplete="off"
        disabled={disabled}
      />
      {loading ? (
        <Loader2 className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[rgb(var(--text-muted))]" />
      ) : null}

      {open && debounced.length >= 2 && (options.length > 0 || !loading) ? (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 text-sm shadow-lg"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
              Tidak ada tokoh yang cocok.
            </li>
          ) : (
            options.map((opt, idx) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={idx === highlight}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  // Prevent the input from blurring before the click registers.
                  e.preventDefault()
                  pick(opt)
                }}
                className={
                  'flex cursor-pointer flex-col px-3 py-2 ' +
                  (idx === highlight
                    ? 'bg-[rgb(var(--primary))]/15 text-[rgb(var(--text))]'
                    : 'text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]')
                }
              >
                <span className="truncate font-medium">{opt.nameFullId}</span>
                {opt.nameFullAr ? (
                  <span
                    dir="rtl"
                    lang="ar"
                    className="truncate text-xs text-[rgb(var(--text-muted))]"
                    style={{ fontFamily: 'var(--font-body-arab)' }}
                  >
                    {opt.nameFullAr}
                  </span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
