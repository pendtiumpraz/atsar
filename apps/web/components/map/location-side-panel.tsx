// `<LocationSidePanel />` — right-hand pane on `/map`.
//
// Shown when the user clicks a location marker on the main map.  Lists the
// top 5 figures linked to that location and links each one to its detail page.
//
// Behaviour:
//   - When no `location` is selected, renders an empty-state placeholder.
//   - When selected, fires a TanStack Query against `/figures?locationId=…`.
//     The backend route doesn't currently honour `locationId` (the figures
//     endpoint exposes only q / category / gender), so we treat any empty
//     payload as "wiring pending" and surface a friendly "Segera hadir" copy
//     instead of an alarming empty list.
//   - On viewports < `lg`, the panel collapses into a bottom sheet via the
//     `compact` prop, which the parent toggles based on viewport width.
//
// Selection is controlled by the parent: we only render data, we don't track
// state.  This keeps the component testable in isolation and avoids two
// sources of truth (URL search params vs. local state).

'use client'

import { useQuery } from '@tanstack/react-query'
import { ExternalLink, X } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { figuresApi, type Paginated } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

export interface LocationSummary {
  id: string
  slug: string
  nameAr: string
  nameId: string
  modernName?: string | null
  countryCode?: string | null
}

interface FigureLite {
  id?: string
  slug: string
  nameFullId?: string
  nameShortId?: string
  nameFullAr?: string
  categoryId?: string
}

export interface LocationSidePanelProps {
  /** Currently-selected location.  `null` renders the empty state. */
  location: LocationSummary | null
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

export function LocationSidePanel({
  location,
  onClose,
  compact = false,
  className,
}: LocationSidePanelProps) {
  // The `/api/v1/figures` endpoint doesn't accept `locationId` yet (see
  // `figure.schemas.ts` — schema only takes q/category/gender/page).  Until
  // that lands we keep the query disabled and surface a "Segera hadir"
  // placeholder.  The cache key is namespaced by location so the future
  // wiring becomes a one-line change (flip this flag + add the filter).
  const supportsLocationFilter: boolean = false
  const query = useQuery<Paginated<FigureLite>>({
    queryKey: ['map-figures-by-location', location?.id ?? null],
    queryFn: () =>
      figuresApi.list({ perPage: 5, page: 1 }) as Promise<Paginated<FigureLite>>,
    enabled: !!location && supportsLocationFilter,
    staleTime: 60_000,
  })

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
  const figures = query.data?.rows ?? []
  const total = query.data?.total ?? 0
  const isLoading = supportsLocationFilter && (query.isPending || query.isFetching)
  const isWiringPending = !supportsLocationFilter || (!isLoading && figures.length === 0)

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
        {isLoading ? (
          <PanelSkeleton />
        ) : query.isError ? (
          <div
            role="alert"
            className="rounded-md border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-3 text-sm text-[rgb(var(--danger))]"
          >
            Gagal memuat tokoh terkait lokasi ini.
          </div>
        ) : isWiringPending ? (
          <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4 text-center text-sm text-[rgb(var(--text-muted))]">
            <div className="mb-1 text-base text-[rgb(var(--text-faint))]" aria-hidden>
              ⏳
            </div>
            Daftar tokoh per lokasi <strong>segera hadir</strong>.
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-[rgb(var(--text-muted))]">
              <strong className="text-[rgb(var(--text))]">{total}</strong> tokoh terkait
            </p>
            <ul className="flex flex-col gap-2">
              {figures.slice(0, 5).map((figure) => (
                <li key={figure.id ?? figure.slug}>
                  <Link
                    href={`/figures/${figure.slug}`}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md border border-transparent px-3 py-2 text-sm transition-colors',
                      'hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[rgb(var(--text))]">
                      {figure.nameFullId ?? figure.nameShortId ?? figure.slug}
                    </span>
                    <ExternalLink
                      className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--text-faint))]"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
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

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 4 }).map((_, idx) => (
        <div
          key={idx}
          className="h-10 animate-pulse rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
        />
      ))}
    </div>
  )
}

export default LocationSidePanel
