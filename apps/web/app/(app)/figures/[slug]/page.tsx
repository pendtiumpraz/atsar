// `/figures/[slug]` — detail view of the 1-page CRUD pattern.
//
// Server component: loads the figure on the server so we can:
//   - Trigger `notFound()` immediately for invalid slugs (404 page).
//   - Set per-figure metadata (title etc).
//   - Hydrate `<FigureDetail />`'s TanStack Query cache via `initialData` so
//     there's no client loading flash when the route swaps in.
//
// `searchParams` are preserved end-to-end: the filter bar reads / writes them
// (URL is the single source of truth), the list grid uses them, and the back
// button stitches them back into the `/figures` href.  The result is a
// "stateful" list pane that remembers filters across navigation.
//
// Auth + subscription are already gated by `(app)/layout.tsx`.  The figure
// service itself doesn't enforce `figures.view` — that lives in the HTTP
// route — but per WIREFRAMES §20 every authenticated subscriber has
// `figures.view`, so direct service access is safe here.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BackButton } from '@/components/figures/back-button'
import { FigureDetail, type FigureDetailData } from '@/components/figures/figure-detail'
import { FigureFilterBar } from '@/components/figures/figure-filter-bar'
import { FigureGrid } from '@/components/figures/figure-grid'
import { ListDetailShell } from '@/components/figures/list-detail-shell'
import { ApiError } from '@/lib/server/api'
import { figureService } from '@/lib/server/services/figure.service'

interface FigureDetailPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

async function loadFigure(slug: string) {
  try {
    return await figureService.getBySlug(slug)
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') {
      return null
    }
    throw err
  }
}

export async function generateMetadata(
  { params }: FigureDetailPageProps,
): Promise<Metadata> {
  const { slug } = await params
  const figure = await loadFigure(slug)
  if (!figure) {
    return { title: 'Tokoh tidak ditemukan' }
  }
  const latin = figure.nameFullId || figure.nameShortId || slug
  return {
    title: latin,
    description: figure.summaryId || figure.summaryAr || undefined,
  }
}

export default async function FigureDetailPage({
  params,
  searchParams,
}: FigureDetailPageProps) {
  const { slug } = await params
  const sp = await searchParams

  const figure = await loadFigure(slug)
  if (!figure) notFound()

  const q = pick(sp.q)
  const category = pick(sp.category)
  const genderRaw = pick(sp.gender)
  const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : undefined
  const pageRaw = pick(sp.page)
  const page = pageRaw ? Math.max(1, Number(pageRaw) || 1) : 1

  return (
    <div className="flex flex-col gap-4">
      <FigureFilterBar />

      <ListDetailShell
        showDetailOnly
        leftSlot={
          <FigureGrid
            query={{ q, category, gender, page }}
            selectedSlug={slug}
          />
        }
        rightSlot={
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <BackButton />
              {/* Placeholder action area — F18 (admin) will inject Edit / PDF here. */}
            </div>
            <FigureDetail
              slug={slug}
              initialData={figure as unknown as FigureDetailData}
            />
          </div>
        }
      />
    </div>
  )
}
