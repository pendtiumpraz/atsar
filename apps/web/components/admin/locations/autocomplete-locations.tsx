// `<LocationAutocomplete />` — debounced combobox for picking a location
// (city / region / landmark) by name. Mirrors `<FigureAutocomplete />` shape
// so the figure edit form can compose them side-by-side.
//
// GET /api/v1/locations?q=… returns the FULL active list (no pagination —
// the map already loads the whole layer). We filter client-side for the
// dropdown but still pass `q` so the backend ILIKE narrows the wire
// payload for large queries.

'use client'

import * as React from 'react'
import { Loader2, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { api } from '@/lib/api/client'

export interface LocationOption {
  id: string
  slug: string
  nameId: string
  nameAr: string | null
  modernName: string | null
  region: string | null
  countryCode: string | null
}

export interface LocationAutocompleteProps {
  value: LocationOption | null
  onChange: (next: LocationOption | null) => void
  placeholder?: string
  id?: string
  invalid?: boolean
  disabled?: boolean
}

const DEBOUNCE_MS = 300
const MAX_RESULTS = 10

interface LocationRow {
  id: string
  slug: string
  nameId: string
  nameAr: string | null
  modernName: string | null
  region: string | null
  countryCode: string | null
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Cari lokasi…',
  id,
  invalid = false,
  disabled = false,
}: LocationAutocompleteProps) {
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [options, setOptions] = React.useState<LocationOption[]>([])
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [highlight, setHighlight] = React.useState(0)
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  React.useEffect(() => {
    if (debounced.length < 2) {
      setOptions([])
      return
    }
    let cancelled = false
    setLoading(true)
    api
      .get<LocationRow[]>(`/locations?q=${encodeURIComponent(debounced)}`)
      .then((rows) => {
        if (cancelled) return
        const opts = (rows ?? []).slice(0, MAX_RESULTS).map<LocationOption>((r) => ({
          id: r.id,
          slug: r.slug,
          nameId: r.nameId,
          nameAr: r.nameAr,
          modernName: r.modernName,
          region: r.region,
          countryCode: r.countryCode,
        }))
        setOptions(opts)
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
  }, [debounced])

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(opt: LocationOption) {
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

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-[rgb(var(--text))]">
            {value.nameId}
            {value.modernName ? (
              <span className="ml-1 text-xs font-normal text-[rgb(var(--text-muted))]">
                ({value.modernName})
              </span>
            ) : null}
          </span>
          {value.nameAr ? (
            <span
              dir="rtl"
              lang="ar"
              className="truncate text-xs text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {value.nameAr}
            </span>
          ) : null}
          {value.region || value.countryCode ? (
            <span className="truncate text-[10px] text-[rgb(var(--text-faint))]">
              {[value.region, value.countryCode].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label="Hapus pilihan lokasi"
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
              Tidak ada lokasi yang cocok.
            </li>
          ) : (
            options.map((opt, idx) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={idx === highlight}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
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
                <span className="truncate font-medium">
                  {opt.nameId}
                  {opt.modernName ? (
                    <span className="ml-1 text-xs font-normal text-[rgb(var(--text-muted))]">
                      ({opt.modernName})
                    </span>
                  ) : null}
                </span>
                {opt.nameAr ? (
                  <span
                    dir="rtl"
                    lang="ar"
                    className="truncate text-xs text-[rgb(var(--text-muted))]"
                    style={{ fontFamily: 'var(--font-body-arab)' }}
                  >
                    {opt.nameAr}
                  </span>
                ) : null}
                {opt.region || opt.countryCode ? (
                  <span className="truncate text-[10px] text-[rgb(var(--text-faint))]">
                    {[opt.region, opt.countryCode].filter(Boolean).join(' · ')}
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
