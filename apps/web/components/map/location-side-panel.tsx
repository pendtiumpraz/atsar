// `<LocationSidePanel />` — right-hand pane on `/map`.
//
// Shown when the user clicks a location marker on the main map.  Groups the
// figures linked to that location FIRST by category (tabbed) THEN by their
// role (lahir / wafat / dimakamkan / dakwah), each linking to its detail page.
//
// Data flow:
//   The figures list is supplied by the parent page (`map/page.tsx`) via
//   the `figures` prop — same payload as `/api/v1/figures/map-points`, just
//   filtered down to the selected location AND intersected with whatever URL
//   filter the user has active on `<LayerControls />`.  No internal HTTP call,
//   so the panel stays cheap and the parent retains a single source of truth.
//
// Tabs:
//   Nabi / Pra-Rasul ﷺ / Sahabat / Shahabiyat / Tabi'in / Tabi'ut Tabi'in /
//   Pasca-Salaf.  "Shahabiyat" is derived from `categorySlug=sahabat &
//   gender=female` — the API already includes gender per figure row.  Empty
//   tabs are hidden so users only see categories present at this location.
//
// Behaviour:
//   - When no `location` is selected, renders an empty-state placeholder.
//   - When selected with NO figures, renders a friendly "Belum ada tokoh".
//   - On viewports < `lg`, the panel collapses into a bottom sheet via the
//     `compact` prop, which the parent toggles based on viewport width.

'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

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
  /** Gender — derives the "Shahabiyat" sub-tab from `sahabat + female`. */
  gender?: 'male' | 'female' | null
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
  /** Total active URL-filter count — drives the "Filter aktif: N" badge. */
  activeFilterCount?: number
  /** Called when the user clicks the "Clear" button in the filter badge. */
  onClearFilters?: () => void
  className?: string
}

/**
 * Convert an ISO-3166 alpha-2 country code into the matching flag emoji.
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

/**
 * Category-tab spec.  Tabs are derived from the figures present at the
 * selected location: only non-empty tabs render.  `sahabat` splits by gender
 * so "Shahabiyat" gets its own pill.
 *
 * The `match` predicate decides which figures belong to the tab.  Order in
 * this array determines tab order in the UI.
 */
interface CategoryTab {
  id: string
  label: string
  match: (f: SidePanelFigure) => boolean
}

const CATEGORY_TABS: ReadonlyArray<CategoryTab> = [
  { id: 'nabi', label: 'Nabi', match: (f) => f.categorySlug === 'nabi' },
  {
    id: 'shalih_pre_rasul',
    label: 'Pra-Rasul ﷺ',
    match: (f) => f.categorySlug === 'shalih_pre_rasul',
  },
  {
    id: 'sahabat',
    label: 'Sahabat',
    match: (f) => f.categorySlug === 'sahabat' && f.gender !== 'female',
  },
  {
    id: 'shahabiyat',
    label: 'Shahabiyat',
    match: (f) => f.categorySlug === 'sahabat' && f.gender === 'female',
  },
  {
    id: 'tabiin',
    label: "Tabi'in",
    match: (f) => f.categorySlug === 'tabiin',
  },
  {
    id: 'tabiut_tabiin',
    label: "Tabi'ut Tabi'in",
    match: (f) => f.categorySlug === 'tabiut_tabiin',
  },
  {
    id: 'shalih_pasca_rasul',
    label: 'Pasca-Salaf',
    match: (f) => f.categorySlug === 'shalih_pasca_rasul',
  },
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
  activeFilterCount = 0,
  onClearFilters,
  className,
}: LocationSidePanelProps) {
  // Bucket per category tab — also computes the visible tab list (non-empty
  // categories only) so we can hide tabs that have nothing at this location.
  // Figures whose `categorySlug` doesn't match any known tab fall into an
  // implicit "other" bucket that surfaces under an "Lainnya" pill so they
  // aren't silently dropped.
  const { tabBuckets, visibleTabs } = useMemo(() => {
    const buckets = new Map<string, SidePanelFigure[]>()
    for (const tab of CATEGORY_TABS) buckets.set(tab.id, [])
    const others: SidePanelFigure[] = []
    for (const f of figures) {
      const tab = CATEGORY_TABS.find((t) => t.match(f))
      if (tab) {
        const arr = buckets.get(tab.id)
        if (arr) arr.push(f)
      } else {
        others.push(f)
      }
    }
    const tabs: Array<{ id: string; label: string; count: number }> = []
    for (const tab of CATEGORY_TABS) {
      const items = buckets.get(tab.id)
      if (items && items.length > 0) {
        tabs.push({ id: tab.id, label: tab.label, count: items.length })
      }
    }
    if (others.length > 0) {
      buckets.set('lainnya', others)
      tabs.push({ id: 'lainnya', label: 'Lainnya', count: others.length })
    }
    return { tabBuckets: buckets, visibleTabs: tabs }
  }, [figures])

  // Active tab — defaults to the first non-empty tab, but falls back to the
  // first tab in the canonical order if the previously-active tab vanishes
  // (e.g. because the user toggled an outside filter).
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const resolvedTabId = useMemo(() => {
    if (visibleTabs.length === 0) return null
    if (activeTabId && visibleTabs.some((t) => t.id === activeTabId)) return activeTabId
    return visibleTabs[0]?.id ?? null
  }, [activeTabId, visibleTabs])

  // Items shown in the active tab, sub-grouped by role.
  const groupedForActive = useMemo(() => {
    if (!resolvedTabId) return null
    const items = tabBuckets.get(resolvedTabId) ?? []
    const buckets = new Map<SidePanelFigure['role'], SidePanelFigure[]>()
    for (const role of ROLE_ORDER) buckets.set(role, [])
    for (const f of items) {
      const arr = buckets.get(f.role)
      if (arr) arr.push(f)
    }
    for (const arr of buckets.values()) {
      arr.sort((a, b) => a.nameFullId.localeCompare(b.nameFullId, 'id'))
    }
    return buckets
  }, [resolvedTabId, tabBuckets])

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
          {activeFilterCount > 0 ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--accent))]/40 bg-[rgb(var(--accent))]/10 px-2 py-0.5 text-[11px] font-medium text-[rgb(var(--accent))]">
              <span>Filter aktif: {activeFilterCount}</span>
              {onClearFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-full px-1 text-[10px] uppercase tracking-wide underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
                  aria-label="Bersihkan filter"
                >
                  Bersihkan
                </button>
              ) : null}
            </div>
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
            {activeFilterCount > 0
              ? 'Tidak ada tokoh yang cocok dengan filter aktif di lokasi ini.'
              : 'Belum ada tokoh yang terdaftar di lokasi ini.'}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-[rgb(var(--text-muted))]">
              <strong className="text-[rgb(var(--text))]">{total}</strong> tokoh terkait
            </p>

            {/* Category tabs — only non-empty categories render. */}
            <nav
              role="tablist"
              aria-label="Kategori tokoh"
              className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map((tab) => {
                const active = tab.id === resolvedTabId
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTabId(tab.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                      active
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                        : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
                    )}
                  >
                    <span className="whitespace-nowrap">{tab.label}</span>
                    <span
                      className={cn(
                        'inline-flex h-4 min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold',
                        active
                          ? 'bg-[rgb(var(--accent))]/20 text-[rgb(var(--accent))]'
                          : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))]',
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Active tab contents — figures grouped by role within the
                selected category. */}
            {groupedForActive ? (
              <div
                role="tabpanel"
                aria-label="Daftar tokoh dalam kategori terpilih"
                className="flex flex-col gap-4"
              >
                {ROLE_ORDER.map((role) => {
                  const items = groupedForActive.get(role) ?? []
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
                {/* Defensive: tab with figures but somehow none in any role. */}
                {(() => {
                  const flat = ROLE_ORDER.reduce(
                    (n, role) => n + (groupedForActive.get(role)?.length ?? 0),
                    0,
                  )
                  if (flat === 0) {
                    return (
                      <p className="text-center text-xs text-[rgb(var(--text-muted))]">
                        Belum ada tokoh dari kategori ini di lokasi ini.
                      </p>
                    )
                  }
                  return null
                })()}
              </div>
            ) : null}
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
