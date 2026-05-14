// `/admin/figures/[slug]/edit` — minimal edit page for a figure draft.
//
// The full schema (kunyah, laqab, locations, citations, rijal grade, …) is
// a large undertaking and lives behind a follow-up. This page surfaces
// the *minimum* fields that an admin needs after the AI ingest worker
// finishes so the "Lihat draf" link from `<FigureIngestPanel />` actually
// goes somewhere useful:
//
//   - slug (read-only header)
//   - name (Indonesian + Arabic)
//   - summary (Indonesian + Arabic)
//   - birth / death year (AH + CE)
//   - status toggle (draft ↔ published) with a confirm step
//
// Larger fields are reachable via the JSON API for now; this page is
// designed to grow rather than be the final form. See
// `lib/server/services/figure.schemas.ts` for the full field list.

import { notFound } from 'next/navigation'

import { FigureEditForm } from '@/components/admin/figures/figure-edit-form'
import * as figureService from '@/lib/server/services/figure.service'

interface PageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  return { title: `Edit Tokoh · ${slug} · Admin Atsar` }
}

export default async function AdminFigureEditPage({ params }: PageProps) {
  const { slug } = await params

  let figure
  try {
    figure = await figureService.getBySlug(slug)
  } catch {
    notFound()
  }

  return (
    <FigureEditForm
      initial={{
        slug: figure.slug,
        nameFullId: figure.nameFullId,
        nameFullAr: figure.nameFullAr,
        summaryId: figure.summaryId ?? '',
        summaryAr: figure.summaryAr ?? '',
        birthDateAh: figure.birthDateAh,
        birthDateCe: figure.birthDateCe,
        deathDateAh: figure.deathDateAh,
        deathDateCe: figure.deathDateCe,
        status: figure.status,
        publishedAt: figure.publishedAt
          ? figure.publishedAt instanceof Date
            ? figure.publishedAt.toISOString()
            : figure.publishedAt
          : null,
      }}
    />
  )
}
