// Scrollable list of figure cards.  Lives inside the left pane of the 1-page
// CRUD shell (WIREFRAMES §6).
//
// - 'use client' so we can use TanStack Query for cache-coherent refetches
//   when filters change without a hard page reload.
// - Query key is `['figures', { q, category, gender, page }]` — keep this
//   in sync with any mutation `invalidateQueries` callsites.
// - Renders a small skeleton on first load; subsequent navigations reuse the
//   previous data while refetching in the background (`placeholderData`).
// - When `selectedSlug` matches a card, that card renders with the active
//   highlight.  Selection is URL-driven (Next.js link in `<FigureCard />`).
//
// NOTE: WIREFRAMES §6 calls for `react-virtual` once lists get large.  Skipped
// here per F10 scope — first 100 figures fit fine in a vanilla list.

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { FigureCard, type FigureCardData } from '@/components/figures/figure-card'
import { figuresApi, type FigureListParams, type Paginated } from '@/lib/api/endpoints'

export interface FigureGridQuery extends FigureListParams {}

export interface FigureGridProps {
  query?: FigureGridQuery
  /** Slug of currently-open figure (for active highlight). */
  selectedSlug?: string
}

export function FigureGrid({ query, selectedSlug }: FigureGridProps) {
  // Normalise undefined / empty fields so the cache key is stable.
  const params = useMemo<FigureListParams>(
    () => ({
      q: query?.q || undefined,
      category: query?.category || undefined,
      gender: query?.gender || undefined,
      page: query?.page ?? 1,
      perPage: query?.perPage ?? 20,
    }),
    [query?.q, query?.category, query?.gender, query?.page, query?.perPage],
  )

  const { data, isPending, isError, error, isFetching } = useQuery<
    Paginated<FigureCardData>
  >({
    queryKey: ['figures', params],
    queryFn: () => figuresApi.list(params) as Promise<Paginated<FigureCardData>>,
    placeholderData: keepPreviousData,
  })

  function buildHref(slug: string): string {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.category) search.set('category', params.category)
    if (params.gender) search.set('gender', params.gender)
    if (params.page && params.page !== 1) search.set('page', String(params.page))
    const qs = search.toString()
    return qs.length > 0 ? `/figures/${slug}?${qs}` : `/figures/${slug}`
  }

  if (isPending) {
    return <FigureGridSkeleton />
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-4 text-sm text-[rgb(var(--danger))]"
      >
        Gagal memuat daftar tokoh.
        {error instanceof Error ? <div className="mt-1 opacity-80">{error.message}</div> : null}
      </div>
    )
  }

  const rows = data?.rows ?? []
  const total = data?.total ?? 0

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center text-sm text-[rgb(var(--text-muted))]">
        Tidak ada tokoh ditemukan.
        {params.q || params.category || params.gender ? (
          <div className="mt-1 text-xs text-[rgb(var(--text-faint))]">
            Coba ubah filter atau kata kunci pencarian.
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2" aria-busy={isFetching ? 'true' : 'false'}>
      <div className="flex items-center justify-between px-1 text-xs text-[rgb(var(--text-faint))]">
        <span>{total} tokoh</span>
        {isFetching ? <span aria-live="polite">Memuat…</span> : null}
      </div>
      <ul className="flex max-h-[calc(100vh-220px)] flex-col gap-2 overflow-y-auto pr-1">
        {rows.map((figure) => (
          <li key={figure.id ?? figure.slug}>
            <FigureCard
              figure={figure}
              isActive={selectedSlug === figure.slug}
              href={buildHref(figure.slug)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FigureGridSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div
          key={idx}
          className="h-20 animate-pulse rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
        />
      ))}
    </div>
  )
}
