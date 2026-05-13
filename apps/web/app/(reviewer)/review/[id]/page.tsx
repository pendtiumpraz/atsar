// `/reviewer/review/[id]` — side-by-side review surface (WIREFRAMES §27).
//
// Server component. We load the assignment + content + citations directly via
// `reviewService.getAssignmentDetail` (same call the API route uses) so the
// initial render is fully populated.
//
// Layout:
//   <ReviewSideBySide />   — left = source iframe / right = drafted content
//   <DecisionBar />        — sticky bottom: Approve / Request Edit / Reject

import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'

import { DecisionBar } from '@/components/reviewer/decision-bar'
import {
  ReviewSideBySide,
  type ReviewCitation,
} from '@/components/reviewer/review-side-by-side'
import { auth } from '@/lib/server/auth'
import { reviewService } from '@/lib/server/services/review.service'

export const dynamic = 'force-dynamic'

interface ReviewPageProps {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()

export async function generateMetadata(
  { params }: ReviewPageProps,
): Promise<Metadata> {
  const { id } = await params
  return {
    title: `Review · ${id.slice(0, 8)} · Atsar`,
  }
}

/** Pluck a string field from the loosely-typed content row, tolerating null. */
function pickString(
  row: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!row) return null
  const value = row[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

export default async function ReviewerReviewPage({ params }: ReviewPageProps) {
  const { id: rawId } = await params
  const parsed = idSchema.safeParse(rawId)
  if (!parsed.success) notFound()
  const id = parsed.data

  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  let detail
  try {
    detail = await reviewService.getAssignmentDetail(id, userId)
  } catch {
    // Service throws for NOT_FOUND / PERMISSION_DENIED — either way the route
    // should 404 to avoid leaking which case occurred.
    notFound()
  }

  const { assignment, content, citations } = detail

  // Title + body fields differ slightly between figures and battles. We pluck
  // the right pair so the side-by-side renderer stays content-agnostic.
  const isFigure = assignment.contentType === 'figure'
  const titleId = isFigure
    ? pickString(content, 'nameShortId') ?? pickString(content, 'nameFullId')
    : pickString(content, 'nameId')
  const titleAr = isFigure
    ? pickString(content, 'nameShortAr') ?? pickString(content, 'nameFullAr')
    : pickString(content, 'nameAr')
  const bodyId = isFigure
    ? pickString(content, 'biographyId') ?? pickString(content, 'summaryId')
    : pickString(content, 'descriptionId') ?? pickString(content, 'summaryId')
  const bodyAr = isFigure
    ? pickString(content, 'biographyAr') ?? pickString(content, 'summaryAr')
    : pickString(content, 'descriptionAr') ?? pickString(content, 'summaryAr')

  const displayTitle = titleId || titleAr || `(tanpa judul) · ${assignment.contentId.slice(0, 8)}`

  // Coerce citation rows to the lightweight shape the client expects.
  // confidenceScore comes back as a string (numeric) — leave it as `string |
  // number` and let the client format if needed.
  const reviewCitations: ReviewCitation[] = citations.map((c) => ({
    id: c.id,
    sourceUrl: c.sourceUrl,
    sourceDomain: c.sourceDomain,
    sourceExcerptId: c.sourceExcerptId,
    sourceExcerptAr: c.sourceExcerptAr,
    sourceLang: c.sourceLang,
    fieldPath: c.fieldPath,
    confidenceScore: c.confidenceScore,
  }))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/queue"
            className="text-sm text-[rgb(var(--text-muted))] underline-offset-4 hover:underline"
          >
            ◀ Antrian
          </Link>
          <h1
            className="text-xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Review: {displayTitle}
          </h1>
        </div>
        <span className="text-xs text-[rgb(var(--text-muted))]">
          Status: {assignment.status}
          {' · '}
          {citations.length} citation
        </span>
      </header>

      <ReviewSideBySide
        title={displayTitle}
        bodyId={bodyId}
        bodyAr={bodyAr}
        citations={reviewCitations}
      />

      <DecisionBar assignmentId={assignment.id} contentLabel={displayTitle} />
    </div>
  )
}
