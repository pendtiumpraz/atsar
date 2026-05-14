// `/admin/figures/[slug]/edit` — full-surface edit page for a figure.
//
// We hydrate the page server-side with EVERYTHING the form needs:
//   - The figure itself (with relations / locations / battles / citations
//     pre-joined by `figureService.getBySlug`).
//   - The active figure_categories list (for the category dropdown).
//   - The active whitelist domains (for the "Cek whitelist" indicator on
//     citation rows).
//
// The form component (`<FigureEditForm />`) handles every panel —
// Identitas, Biografi, Timeline, Peta, Hubungan, Hadits & Rijal, and
// Sumber. See its top-of-file comment for the panel breakdown.

import { and, asc, eq, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'

import { db } from '@athar/db'
import { figureCategories, whitelistDomains } from '@athar/db/schema'

import { FigureEditForm } from '@/components/admin/figures/figure-edit-form'
import { FigureReingestPanel } from '@/components/admin/figures/figure-reingest-panel'
import * as figureService from '@/lib/server/services/figure.service'
import type { FigureWithRelations } from '@/lib/server/services/figure.service'

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

  let figure: FigureWithRelations
  try {
    figure = await figureService.getBySlug(slug)
  } catch {
    notFound()
  }

  // Active figure_categories — small table, no pagination.
  const categories = await db
    .select({
      id: figureCategories.id,
      slug: figureCategories.slug,
      nameId: figureCategories.nameId,
    })
    .from(figureCategories)
    .where(and(eq(figureCategories.isActive, true), isNull(figureCategories.deletedAt)))
    .orderBy(asc(figureCategories.sortOrder), asc(figureCategories.nameId))

  // Active whitelist domains — used by the citation subform's red/green
  // warning. Soft-deleted / inactive rows are excluded.
  const whitelistRows = await db
    .select({ domain: whitelistDomains.domain })
    .from(whitelistDomains)
    .where(
      and(
        eq(whitelistDomains.isActive, true),
        isNull(whitelistDomains.deletedAt),
      ),
    )

  // Snapshot the AI-comparison fields the re-ingest diff panel needs.
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

  // ── Build the form's initial state from the joined figure row ────────
  // figureService.getBySlug returns location rows already joined; map them
  // into the option shape the form expects.

  function locOptionFromId(id: string | null) {
    if (!id) return null
    const row = figure.locations.find((l) => l.location.id === id)
    if (!row) return null
    return {
      id: row.location.id,
      slug: row.location.slug,
      nameId: row.location.nameId,
      nameAr: row.location.nameAr,
      modernName: row.location.modernName,
      region: row.location.region,
      countryCode: row.location.countryCode,
    }
  }

  // figure_locations: keep only true M2M rows (`role` ∈ enum). The service
  // also splices "synthetic" rows for direct FKs — we still render them in
  // the list so admin sees the full picture, but mark them via the `direct:`
  // id prefix so the delete button is hidden.
  const figureLocationRows = figure.locations
    .filter((l) =>
      ['birthplace', 'residence', 'dakwah', 'martyr', 'burial'].includes(l.role),
    )
    .map((l) => ({
      id: l.id,
      role: l.role as 'birthplace' | 'residence' | 'dakwah' | 'martyr' | 'burial',
      location: {
        id: l.location.id,
        slug: l.location.slug,
        nameId: l.location.nameId,
        nameAr: l.location.nameAr,
        modernName: l.location.modernName,
        region: l.location.region,
        countryCode: l.location.countryCode,
      },
    }))

  return (
    <div className="flex flex-col gap-8">
      <FigureEditForm
        categories={categories}
        whitelistDomains={whitelistRows.map((r) => r.domain)}
        initial={{
          id: figure.id,
          slug: figure.slug,
          categoryId: figure.categoryId,
          gender: figure.gender,
          nameFullId: figure.nameFullId,
          nameFullAr: figure.nameFullAr,
          nameShortId: figure.nameShortId,
          nameShortAr: figure.nameShortAr,
          kunyahId: figure.kunyahId,
          kunyahAr: figure.kunyahAr,
          laqabId: figure.laqabId,
          laqabAr: figure.laqabAr,
          status: figure.status,
          publishedAt: figure.publishedAt
            ? figure.publishedAt instanceof Date
              ? figure.publishedAt.toISOString()
              : figure.publishedAt
            : null,

          summaryId: figure.summaryId,
          summaryAr: figure.summaryAr,
          biographyPreWafatId: figure.biographyPreWafatId,
          biographyPreWafatAr: figure.biographyPreWafatAr,
          biographyPostWafatId: figure.biographyPostWafatId,
          biographyPostWafatAr: figure.biographyPostWafatAr,
          biographyId: figure.biographyId,
          biographyAr: figure.biographyAr,

          birthDateAh: figure.birthDateAh,
          birthDateCe: figure.birthDateCe,
          birthDatePrecision: figure.birthDatePrecision,
          birthDateNotes: figure.birthDateNotes,
          deathDateAh: figure.deathDateAh,
          deathDateCe: figure.deathDateCe,
          deathDatePrecision: figure.deathDatePrecision,
          deathDateNotes: figure.deathDateNotes,

          primaryLocation: locOptionFromId(figure.primaryLocationId),
          deathLocation: locOptionFromId(figure.deathLocationId),
          burialLocation: locOptionFromId(figure.burialLocationId),
          figureLocations: figureLocationRows,

          relations: figure.relations.map((r) => ({
            id: r.id,
            relationType: r.relationType,
            related: {
              id: r.related.id,
              slug: r.related.slug,
              nameFullId: r.related.nameFullId,
              nameFullAr: r.related.nameFullAr,
              nameShortId: r.related.nameShortId,
            },
          })),

          battleParticipations: figure.timelineEvents.battles.map((b) => ({
            battleId: b.battleId,
            slug: b.slug,
            nameId: b.nameId,
            nameAr: b.nameAr,
            eventDateAh: b.eventDateAh,
            eventDateCe: b.eventDateCe,
            role: b.role,
          })),

          hadithCountMin: figure.hadithCountMin,
          hadithCountMax: figure.hadithCountMax,
          rijalGrade: figure.rijalGrade,
          rijalNotesId: figure.rijalNotesId,
          rijalNotesAr: figure.rijalNotesAr,
          specialty: figure.specialty,
          madhab: figure.madhab,
          socialCategory: figure.socialCategory,
          deathCause: figure.deathCause,

          citations: figure.citations.map((c) => ({
            id: c.id,
            sourceUrl: c.sourceUrl,
            sourceDomain: c.sourceDomain,
            fieldPath: c.fieldPath,
            confidenceScore: c.confidenceScore,
            sourceExcerptId: c.sourceExcerptId,
            sourceLang: c.sourceLang,
          })),
        }}
      />

      <FigureReingestPanel slug={figure.slug} current={currentSnapshot} />
    </div>
  )
}
