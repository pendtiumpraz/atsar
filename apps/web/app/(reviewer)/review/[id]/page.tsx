// `/reviewer/review/[id]` — three-pane review surface (WIREFRAMES §27).
//
// Server component. We load the assignment + content + citations + whitelist
// annotations directly via `reviewService.getAssignmentDetail` (same call the
// API route uses) so the initial render is fully populated.
//
// Layout:
//   <ReviewWorkspace />    — three-pane (draft / editable form / citations)
//   <DecisionBar />        — sticky bottom: Setuju / Minta Perbaikan / Tolak
//
// Both components live inside a shared `EditsContext` (provider lives in
// `<ReviewWorkspace />`), so the DecisionBar can pick up reviewer edits and
// pass them on the /approve POST.

import Link from 'next/link'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'

import { DecisionBar } from '@/components/reviewer/decision-bar'
import {
  ReviewWorkspace,
  ReviewWorkspaceProvider,
  type WorkspaceCitation,
  type WorkspaceEdits,
} from '@/components/reviewer/review-workspace'
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

/**
 * Project a content row onto the {@link WorkspaceEdits} shape. Unknown fields
 * just stay undefined — keeping it loose lets us share one component between
 * figures and battles without two separate prop signatures.
 */
function toWorkspaceEdits(
  row: Record<string, unknown> | null,
  contentType: string,
): WorkspaceEdits {
  if (!row) return {}
  const keys: (keyof WorkspaceEdits)[] =
    contentType === 'figure'
      ? [
          'nameFullId',
          'nameFullAr',
          'nameShortId',
          'nameShortAr',
          'summaryId',
          'summaryAr',
          'biographyId',
          'biographyAr',
        ]
      : ['nameId', 'nameAr', 'summaryId', 'summaryAr', 'descriptionId', 'descriptionAr']
  const out: WorkspaceEdits = {}
  for (const k of keys) {
    const value = row[k]
    if (typeof value === 'string') out[k] = value
    else if (value === null) out[k] = null
  }
  return out
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

  const { assignment, content, citations, whitelistByCitation, originalRevision } = detail

  // Title — used in the header and the approval-confirmation modal.
  const isFigure = assignment.contentType === 'figure'
  const titleId = isFigure
    ? pickString(content, 'nameShortId') ?? pickString(content, 'nameFullId')
    : pickString(content, 'nameId')
  const titleAr = isFigure
    ? pickString(content, 'nameShortAr') ?? pickString(content, 'nameFullAr')
    : pickString(content, 'nameAr')
  const displayTitle = titleId || titleAr || `(tanpa judul) · ${assignment.contentId.slice(0, 8)}`

  // Snapshot the content row as the editable draft + remember the original
  // (= the AI's first revision when available, otherwise the current state).
  // Reviewer edits diff against the original snapshot, not the live draft,
  // so the "↺ Revert" button always restores the AI starting point.
  const draftEdits = toWorkspaceEdits(content, assignment.contentType)
  const originalDiff = (originalRevision?.diff ?? null) as Record<string, unknown> | null
  // `content_revisions.diff` for the 'created' action holds an `{ after: { ... } }`
  // snapshot (per figure.service.create). Fall back to live draft if we
  // can't recover the original.
  const originalRow =
    originalDiff && typeof originalDiff['after'] === 'object' && originalDiff['after'] !== null
      ? (originalDiff['after'] as Record<string, unknown>)
      : content
  const originalEdits = toWorkspaceEdits(originalRow, assignment.contentType)

  // Hydrate citations with their whitelist annotation.
  const workspaceCitations: WorkspaceCitation[] = citations.map((c) => {
    const wl = whitelistByCitation[c.id]
    return {
      id: c.id,
      sourceUrl: c.sourceUrl,
      sourceDomain: c.sourceDomain,
      sourceExcerptId: c.sourceExcerptId,
      sourceExcerptAr: c.sourceExcerptAr,
      sourceLang: c.sourceLang,
      fieldPath: c.fieldPath,
      confidenceScore: c.confidenceScore,
      whitelistPriority: wl?.priority ?? null,
      onWhitelist: wl?.onWhitelist ?? false,
    }
  })

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
          {titleAr ? (
            <span
              lang="ar"
              dir="rtl"
              className="text-base text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {titleAr}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-[rgb(var(--text-muted))]">
          Status: {assignment.status}
          {' · '}
          {citations.length} citation
        </span>
      </header>

      <ReviewWorkspaceProvider initialEdits={draftEdits} baseline={originalEdits}>
        <ReviewWorkspace
          contentType={assignment.contentType}
          draft={draftEdits}
          original={originalEdits}
          citations={workspaceCitations}
        />

        <DecisionBar assignmentId={assignment.id} contentLabel={displayTitle} />
      </ReviewWorkspaceProvider>
    </div>
  )
}
