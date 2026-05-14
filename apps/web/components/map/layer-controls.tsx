// `<LayerControls />` — the toolbar above the map (WIREFRAMES §10).
//
// Surfaces:
//   1. Per-category toggles for all 6 canonical figure-category slugs
//      (Nabi / Pra-Rasul / Sahabat / Tabi'in / Tabi'ut Tabi'in / Pasca-Salaf).
//      Multi-select stored as a comma-separated `?layers=` param so URL stays
//      shareable.  Empty `?layers=` means "show everything".
//   2. Gender filter (Semua / Laki-laki / Perempuan) — `?gender=`.
//   3. Tokoh / Lokasi overlay toggles — `?tokoh=0`, `?lokasi=0`.
//   4. Hijrah-route overlay — `?hijrah=1`.
//
// All state lives in the URL via `useSearchParams` + `router.replace`. That
// way the parent page (`map/page.tsx`) re-reads the params and filters the
// GeoJSON (markers AND side-panel figure list) accordingly, and deep links to
// a specific layer combo keep working.

'use client'

import {
  BookOpen,
  Crown,
  GraduationCap,
  Library,
  MapPin,
  Route,
  Star,
  Users,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type ComponentType, useCallback, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Recognised category layer keys.  Mirrors the seed slugs in
 * `packages/db/src/seeders/007_figure_categories.ts`.
 */
export const CATEGORY_LAYERS = [
  { key: 'nabi', label: 'Nabi', icon: Crown },
  { key: 'shalih_pre_rasul', label: 'Pra-Rasul ﷺ', icon: Star },
  { key: 'sahabat', label: 'Sahabat', icon: Users },
  { key: 'tabiin', label: "Tabi'in", icon: BookOpen },
  { key: 'tabiut_tabiin', label: "Tabi'ut Tabi'in", icon: GraduationCap },
  { key: 'shalih_pasca_rasul', label: 'Pasca-Salaf', icon: Library },
] as const satisfies ReadonlyArray<{
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
}>

export type CategoryLayerKey = (typeof CATEGORY_LAYERS)[number]['key']

const CATEGORY_KEYS: ReadonlySet<string> = new Set(CATEGORY_LAYERS.map((c) => c.key))

const GENDER_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
] as const

/** Parsed view of the URL-driven layer state, exposed so consumers can react. */
export interface LayerState {
  /** Selected category slugs.  Empty set = "all categories visible". */
  categories: ReadonlySet<CategoryLayerKey>
  gender: '' | 'male' | 'female'
  hijrah: boolean
  /** Show the tokoh (figure) overlay.  Default true.  `?tokoh=0` hides it. */
  showFigures: boolean
  /** Show the lokasi (city) overlay.  Default true.  `?lokasi=0` hides it. */
  showLocations: boolean
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
    const trimmed = part.trim()
    if (CATEGORY_KEYS.has(trimmed)) categories.add(trimmed as CategoryLayerKey)
  }
  const genderRaw = params.get('gender')
  const gender =
    genderRaw === 'male' || genderRaw === 'female' ? genderRaw : ''
  const hijrah = params.get('hijrah') === '1'
  // Default ON — only `?tokoh=0` / `?lokasi=0` hides the overlay so deep links
  // stay stable.
  const showFigures = params.get('tokoh') !== '0'
  const showLocations = params.get('lokasi') !== '0'
  return { categories, gender, hijrah, showFigures, showLocations }
}

/**
 * Returns true when any URL filter is non-default — used by callers (e.g. the
 * side panel header) to surface a "Filter aktif" badge with a clear button.
 */
export function isFilterActive(state: LayerState): boolean {
  return (
    state.categories.size > 0 ||
    state.gender !== '' ||
    state.hijrah ||
    !state.showFigures ||
    !state.showLocations
  )
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

  // Single URL writer — preserve the rest of the params so deep-linked
  // positions (zoom/center) survive.
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

  const toggleLocations = useCallback(() => {
    pushParams((p) => {
      if (state.showLocations) p.set('lokasi', '0')
      else p.delete('lokasi')
    })
  }, [pushParams, state.showLocations])

  const allCategoriesActive = state.categories.size === 0

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2',
        className,
      )}
      role="toolbar"
      aria-label="Kontrol lapisan peta"
    >
      {/* "Semua" pseudo-toggle — clicking it clears any active category filters. */}
      <button
        type="button"
        onClick={() =>
          pushParams((p) => {
            p.delete('layers')
          })
        }
        aria-pressed={allCategoriesActive}
        className={cn(
          'h-8 rounded-md border px-3 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
          allCategoriesActive
            ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
            : 'border-[rgb(var(--border))] bg-transparent text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
        )}
      >
        Semua
      </button>

      <div
        role="group"
        aria-label="Per kategori"
        className="flex flex-wrap items-center gap-1"
      >
        {CATEGORY_LAYERS.map((c) => {
          const active = state.categories.has(c.key)
          const Icon = c.icon
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggleCategory(c.key)}
              aria-pressed={active}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                active
                  ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                  : 'border-[rgb(var(--border))] bg-transparent text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--bg-elevated))] hover:text-[rgb(var(--text))]',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{c.label}</span>
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
          variant={state.showLocations ? 'primary' : 'outline'}
          size="sm"
          onClick={toggleLocations}
          aria-pressed={state.showLocations}
          aria-label={
            state.showLocations ? 'Sembunyikan lokasi' : 'Tampilkan lokasi'
          }
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          <span>Lokasi</span>
        </Button>
        <Button
          type="button"
          variant={state.showFigures ? 'primary' : 'outline'}
          size="sm"
          onClick={toggleFigures}
          aria-pressed={state.showFigures}
          aria-label={
            state.showFigures ? 'Sembunyikan tokoh di peta' : 'Tampilkan tokoh di peta'
          }
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          <span>Tokoh</span>
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
