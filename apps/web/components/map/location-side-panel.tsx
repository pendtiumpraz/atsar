// `<LocationSidePanel />` — right-hand pane on `/map`.
//
// Shown when the user clicks a location marker on the main map.  Lists the
// figures linked to that location, grouped by their role (lahir / wafat /
// dimakamkan / dakwah / hidup), each linking to its detail page.
//
// Data flow:
//   The figures list is supplied by the parent page (`map/page.tsx`) via
//   the `figures` prop — same payload as `/api/v1/figures/map-points`, just
//   filtered down to the selected location.  No internal HTTP call, so the
//   panel stays cheap and the parent retains a single source of truth.
//
// Behaviour:
//   - When no `location` is selected, renders an empty-state placeholder.
//   - When selected with figures, groups them by role and renders each as a
//     link to `/figures/[slug]` with an avatar initial.
//   - When selected with NO figures (e.g. an admin-added city not yet linked
//     to a tokoh), renders a friendly "Belum ada tokoh terdaftar" copy.
//   - On viewports < `lg`, the panel collapses into a bottom sheet via the
//     `compact` prop, which the parent toggles based on viewport width.

'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface LocationSummary {
  id: string
  slug: string
  nameAr: string
  nameId: string
  modernName?: string | null
  countryCode?: string | null
}

/** Figure shape consumed by the side panel — subset of `FigureMapPointRow`. */
export interface SidePanelFigure {
  figureId: string
  slug: string
  nameFullId: string
  nameFullAr?: string
  nameShortId?: string | null
  categorySlug?: string | null
  /** Why this figure is plotted at the selected location. */
  role: 'primary' | 'death' | 'burial' | 'figure_location'
}

export interface LocationSidePanelProps {
  /** Currently-selected location.  `null` renders the empty state. */
  location: LocationSummary | null
  /** Figures linked to this location (parent filters from the map-points payload). */
  figures?: SidePanelFigure[]
  /** Close button handler — clears the parent's selection. */
  onClose?: () => void
  /** Compact (bottom-sheet) styling for narrow viewports. */
  compact?: boolean
  className?: string
}

/**
 * Convert an ISO-3166 alpha-2 country code into the matching flag emoji by
 * mapping each ASCII letter to its regional indicator symbol.  Returns
 * `undefined` when the code isn't a clean two-letter string so callers can
 * skip rendering the emoji entirely.
 */
function flagFromCountry(code?: string | null): string | undefined {
  if (!code) return undefined
  const trimmed = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(trimmed)) return undefined
  const base = 0x1f1e6 - 0x41
  return String.fromCodePoint(...[...trimmed].map((c) => c.charCodeAt(0) + base))
}

/** Human-readable Indonesian label per role. */
const ROLE_LABELS: Record<SidePanelFigure['role'], string> = {
  primary: 'Lahir / Tinggal',
  death: 'Wafat',
  burial: 'Dimakamkan',
  figure_location: 'Terkait',
}

/** Display order — most narratively important first. */
const ROLE_ORDER: SidePanelFigure['role'][] = [
  'primary',
  'death',
  'burial',
  'figure_location',
]

/** First letter (uppercase) of the figure's Indonesian name — avatar fallback. */
function initialOf(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export function LocationSidePanel({
  location,
  figures = [],
  onClose,
  compact = false,
  className,
}: LocationSidePanelProps) {
  // Group figures by role — `Map` preserves insertion order so we drive it
  // off `ROLE_ORDER` to keep the rendering deterministic.
  const grouped = useMemo(() => {
    const buckets = new Map<SidePanelFigure['role'], SidePanelFigure[]>()
    for (const role of ROLE_ORDER) buckets.set(role, [])
    for (const f of figures) {
      const arr = buckets.get(f.role)
      if (arr) arr.push(f)
    }
    // Sort each bucket alphabetically for stable rendering.
    for (const arr of buckets.values()) {
      arr.sort((a, b) => a.nameFullId.localeCompare(b.nameFullId, 'id'))
    }
    return buckets
  }, [figures])

  // Empty state — no location selected yet.
  if (!location) {
    return (
      <aside
        aria-label="Detail lokasi"
        className={cn(
          'flex h-full min-h-[16rem] flex-col items-center justify-center rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center',
          className,
        )}
      >
        <div className="mb-2 text-3xl text-[rgb(var(--text-faint))]" aria-hidden>
          📍
        </div>
        <p className="max-w-xs text-sm text-[rgb(var(--text-muted))]">
          Pilih marker di peta untuk melihat tokoh-tokoh yang terkait dengan lokasi tersebut.
        </p>
      </aside>
    )
  }

  const flag = flagFromCountry(location.countryCode)
  const total = figures.length

  return (
    <aside
      aria-label={`Detail ${location.nameId}`}
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
        compact && 'rounded-t-2xl rounded-b-none shadow-lg',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b border-[rgb(var(--border))] p-4">
        <div className="min-w-0 flex-1">
          <h2
            className="truncate text-lg font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            {location.nameId}
          </h2>
          {location.nameAr ? (
            <p
              dir="rtl"
              className="truncate text-sm text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-arabic)' }}
            >
              {location.nameAr}
            </p>
          ) : null}
          {location.modernName || flag ? (
            <p className="mt-1 text-xs text-[rgb(var(--text-faint))]">
              {flag ? <span aria-hidden>{flag} </span> : null}
              {location.modernName ?? location.countryCode ?? ''}
            </p>
          ) : null}
        </div>
        {onClose ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Tutup detail lokasi"
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {total === 0 ? (
          <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4 text-center text-sm text-[rgb(var(--text-muted))]">
            <div className="mb-1 text-base text-[rgb(var(--text-faint))]" aria-hidden>
              👤
            </div>
            Belum ada tokoh yang terdaftar di lokasi ini.
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-[rgb(var(--text-muted))]">
              <strong className="text-[rgb(var(--text))]">{total}</strong> tokoh terkait
            </p>
            <div className="flex flex-col gap-4">
              {ROLE_ORDER.map((role) => {
                const items = grouped.get(role) ?? []
                if (items.length === 0) return null
                return (
                  <section key={role} aria-label={ROLE_LABELS[role]}>
                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-faint))]">
                      {ROLE_LABELS[role]}{' '}
                      <span className="font-normal">({items.length})</span>
                    </h3>
                    <ul className="flex flex-col gap-1">
                      {items.map((figure) => (
                        <li key={figure.figureId}>
                          <Link
                            href={`/figures/${figure.slug}`}
                            className={cn(
                              'flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 text-sm transition-colors',
                              'hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                            )}
                          >
                            <span
                              aria-hidden
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-semibold text-amber-700 dark:text-amber-300"
                            >
                              {initialOf(figure.nameShortId ?? figure.nameFullId)}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[rgb(var(--text))]">
                              {figure.nameShortId ?? figure.nameFullId}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          </>
        )}
      </div>

      <footer className="border-t border-[rgb(var(--border))] p-3">
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={`/figures?location=${encodeURIComponent(location.slug)}`}>
            Lihat semua tokoh di {location.nameId}
          </Link>
        </Button>
      </footer>
    </aside>
  )
}

export default LocationSidePanel
