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
import { FigureReingestPanel } from '@/components/admin/figures/figure-reingest-panel'
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

  // Snapshot of fields the re-ingest diff panel can compare AI suggestions
  // against. Kept in sync with the focus-field options in
  // `<FigureReingestPanel />`.
  const currentSnapshot = {
    biographyId: figure.biographyId ?? null,
    biographyAr: figure.biographyAr ?? null,
    summaryId: figure.summaryId ?? null,
    summaryAr: figure.summaryAr ?? null,
    kunyahId: figure.kunyahId ?? null,
    kunyahAr: figure.kunyahAr ?? null,
    laqabId: figure.laqabId ?? null,
    laqabAr: figure.laqabAr ?? null,
    birthDateAh: figure.birthDateAh,
    birthDateCe: figure.birthDateCe,
    deathDateAh: figure.deathDateAh,
    deathDateCe: figure.deathDateCe,
    specialty: figure.specialty ?? null,
    madhab: figure.madhab ?? null,
    rijalGrade: figure.rijalGrade ?? null,
  }

  return (
    <div className="flex flex-col gap-8">
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

      <FigureReingestPanel slug={figure.slug} current={currentSnapshot} />
    </div>
  )
}
