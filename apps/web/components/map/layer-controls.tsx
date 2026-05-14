// `<LayerControls />` — the toolbar above the map (WIREFRAMES §10).
//
// Surfaces three knobs:
//   1. Per-category toggles (Nabi / Sahabat / Tabi'in / Tabi'ut / Shalih).
//      Multi-select stored as a comma-separated `?layers=` param so URL stays
//      shareable.  `tokoh` is the umbrella value when no category is set.
//   2. Gender filter (Semua / Laki-laki / Perempuan) — `?gender=`.
//   3. Hijrah-route overlay — `?hijrah=1`.
//
// All state lives in the URL via `useSearchParams` + `router.replace`. That
// way the parent page (`map/page.tsx`) can re-read the params server-side to
// pre-filter the GeoJSON if it wants to, and deep links to a specific layer
// combo keep working.  No internal state needed.

'use client'

import { Route, Users } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Recognised category layer keys.  Mirrors the seed slugs in `figure-categories`. */
export const CATEGORY_LAYERS = [
  { key: 'nabi', label: 'Nabi' },
  { key: 'sahabat', label: 'Sahabat' },
  { key: 'tabiin', label: "Tabi'in" },
  { key: 'tabiut_tabiin', label: "Tabi'ut Tabi'in" },
  { key: 'shalih_pasca_rasul', label: 'Shalih' },
] as const

export type CategoryLayerKey = (typeof CATEGORY_LAYERS)[number]['key']

const GENDER_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
] as const

/** Parsed view of the URL-driven layer state, exposed so consumers can react. */
export interface LayerState {
  categories: ReadonlySet<CategoryLayerKey>
  gender: '' | 'male' | 'female'
  hijrah: boolean
  /** Show the tokoh (figure) overlay.  Default: true.  `?tokoh=0` hides it. */
  showFigures: boolean
}

/**
 * Helper for parent components: parse a search params object the same way the
 * control does.  Exported so the page (server side) can pre-filter the
 * GeoJSON without duplicating the encoding rules.
 */
export function parseLayerState(params: URLSearchParams): LayerState {
  const raw = params.get('layers') ?? ''
  const categories = new Set<CategoryLayerKey>()
  for (const part of raw.split(',')) {
    const trimmed = part.trim() as CategoryLayerKey
    if (CATEGORY_LAYERS.some((c) => c.key === trimmed)) categories.add(trimmed)
  }
  const genderRaw = params.get('gender')
  const gender =
    genderRaw === 'male' || genderRaw === 'female' ? genderRaw : ''
  const hijrah = params.get('hijrah') === '1'
  // Default ON — only `?tokoh=0` hides the overlay so deep links stay stable.
  const showFigures = params.get('tokoh') !== '0'
  return { categories, gender, hijrah, showFigures }
}

export interface LayerControlsProps {
  className?: string
}

export function LayerControls({ className }: LayerControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = useMemo<LayerState>(
    () => parseLayerState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  // Single URL writer — we wipe `?page=` whenever filters change but otherwise
  // preserve the rest so deep-linked positions (zoom/center) survive.
  const pushParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      mutate(next)
      const qs = next.toString()
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, {
        scroll: false,
      })
    },
    [pathname, router, searchParams],
  )

  const toggleCategory = useCallback(
    (key: CategoryLayerKey) => {
      pushParams((p) => {
        const next = new Set(state.categories)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        if (next.size === 0) p.delete('layers')
        else p.set('layers', Array.from(next).join(','))
      })
    },
    [pushParams, state.categories],
  )

  const setGender = useCallback(
    (value: '' | 'male' | 'female') => {
      pushParams((p) => {
        if (value) p.set('gender', value)
        else p.delete('gender')
      })
    },
    [pushParams],
  )

  const toggleHijrah = useCallback(() => {
    pushParams((p) => {
      if (state.hijrah) p.delete('hijrah')
      else p.set('hijrah', '1')
    })
  }, [pushParams, state.hijrah])

  // Toggle figure overlay — default is ON, so we set `?tokoh=0` to hide and
  // clear the param to re-enable (keeps the URL minimal for the common case).
  const toggleFigures = useCallback(() => {
    pushParams((p) => {
      if (state.showFigures) p.set('tokoh', '0')
      else p.delete('tokoh')
    })
  }, [pushParams, state.showFigures])

  const tokohActive = state.categories.size === 0

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2',
        className,
      )}
      role="toolbar"
      aria-label="Kontrol lapisan peta"
    >
      {/* "Tokoh" pseudo-toggle — disabled when categories are empty since it's
          already the implicit state.  Clicking it clears any active filters. */}
      <button
        type="button"
        onClick={() =>
          pushParams((p) => {
            p.delete('layers')
          })
        }
        aria-pressed={tokohActive}
        className={cn(
          'h-8 rounded-md border px-3 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
          tokohActive
            ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
            : 'border-[rgb(var(--border))] bg-transparent text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
        )}
      >
        Tokoh (semua)
      </button>

      <div
        role="group"
        aria-label="Per kategori"
        className="flex flex-wrap items-center gap-1"
      >
        {CATEGORY_LAYERS.map((c) => {
          const active = state.categories.has(c.key)
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              aria-pressed={active}
              className={cn(
                'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                active
                  ? 'border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))]'
                  : 'border-[rgb(var(--border))] bg-transparent text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-elevated))] hover:text-[rgb(var(--text))]',
              )}
            >
              {c.label}
            </button>
          )
        })}
      </div>

      <div className="mx-1 hidden h-6 w-px bg-[rgb(var(--border))] sm:block" aria-hidden />

      <label className="flex items-center gap-1 text-xs text-[rgb(var(--text-muted))]">
        <span className="sr-only">Gender</span>
        <select
          aria-label="Filter gender"
          value={state.gender}
          onChange={(e) => setGender(e.target.value as '' | 'male' | 'female')}
          className={cn(
            'h-8 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-xs text-[rgb(var(--text))]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
          )}
        >
          {GENDER_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <Button
          type="button"
          variant={state.showFigures ? 'primary' : 'outline'}
          size="sm"
          onClick={toggleFigures}
          aria-pressed={state.showFigures}
          aria-label={
            state.showFigures
              ? 'Sembunyikan tokoh di peta'
              : 'Tampilkan tokoh di peta'
          }
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span>Tampilkan Tokoh</span>
        </Button>
        <Button
          type="button"
          variant={state.hijrah ? 'primary' : 'outline'}
          size="sm"
          onClick={toggleHijrah}
          aria-pressed={state.hijrah}
        >
          <Route className="h-3.5 w-3.5" aria-hidden />
          <span>Rute Hijrah</span>
        </Button>
      </div>
    </div>
  )
}

export default LayerControls
