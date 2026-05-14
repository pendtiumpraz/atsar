// Review service — assignment + decision workflow.
// State machine: draft → under_review → needs_edit → approved → published
// See docs/IDEAS.md §5c (Review & Approval Workflow) and DATABASE.md §7.
//
// All decisions:
//   1. Update `review_assignments` (decision + status + decisionAt).
//   2. Append an immutable `content_revisions` row (with action + actor).
//   3. Bump the parent content row's status when the transition demands it.
//   4. Emit an audit log entry.
//
// Steps 1-3 share a single `db.batch([...])` so a partial failure can't leave
// the workflow half-applied. Audit log (step 4) is fire-and-forget.

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import {
  battles,
  citations,
  contentRevisions,
  figures,
  reviewAssignments,
  users,
  whitelistDomains,
} from '@athar/db/schema'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'
import { notificationService } from '@/lib/server/services/notification.service'
import { hasPermission } from '@/lib/server/rbac'

// ── Types ─────────────────────────────────────────────────────────────
type ReviewAssignmentRow = typeof reviewAssignments.$inferSelect
type ReviewStatus = 'pending' | 'in_progress' | 'completed'

/** Content types that can be reviewed. (Citations are reviewed *with* the parent.) */
export type ReviewContentType = 'figure' | 'battle'

export interface QueueQuery {
  status?: ReviewStatus
  page: number
  perPage: number
}

export interface PaginatedAssignments {
  rows: ReviewAssignmentRow[]
  total: number
  page: number
  perPage: number
}

/** Per-citation whitelist annotation: priority + whether host is on whitelist. */
export interface CitationWhitelistInfo {
  /** Reverse lookup key: citation.id */
  citationId: string
  /** Resolved domain (best-effort — falls back to URL host). */
  domain: string | null
  /** Whitelist priority (higher = more authoritative). `null` if not on list. */
  priority: number | null
  /** True when the citation's host is on the active whitelist. */
  onWhitelist: boolean
}

export interface AssignmentDetail {
  assignment: ReviewAssignmentRow
  content: Record<string, unknown> | null
  citations: (typeof citations.$inferSelect)[]
  /** Whitelist annotation per citation — parallel to `citations[]` by id. */
  whitelistByCitation: Record<string, CitationWhitelistInfo>
  /** Original draft revision (lowest revision_number, action='created'). */
  originalRevision: typeof contentRevisions.$inferSelect | null
}

/**
 * Editable fields the reviewer can override before approving. Keeping this
 * narrow on purpose — only the bilingual narrative columns are exposed to
 * the review UI. Slug / category / dates stay locked to the admin surface.
 */
export interface ReviewerEdits {
  nameFullId?: string | null
  nameFullAr?: string | null
  nameShortId?: string | null
  nameShortAr?: string | null
  summaryId?: string | null
  summaryAr?: string | null
  biographyId?: string | null
  biographyAr?: string | null
  // Battles use these:
  nameId?: string | null
  nameAr?: string | null
  descriptionId?: string | null
  descriptionAr?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────
/**
 * Resolve the content table for a given `contentType`. Returns the Drizzle
 * table object so callers can build typed updates / queries.
 *
 * Throws VALIDATION_ERROR for unsupported types — only figures and battles
 * participate in the reviewer workflow (locations are reference data).
 *
 * NOTE: figures and battles share the columns we touch here (`id`, `status`,
 * `publishedAt`, `updatedAt`, `updatedBy`, `deletedAt`) but their Drizzle
 * generic types diverge, so unioning the return type breaks `.set({...})`
 * inference. We narrow to `typeof figures` — it's a structural lie, but
 * every operation we perform is identical between the two tables, and a
 * future third reviewable content type would need real polymorphism here.
 */
function contentTable(contentType: string): typeof figures {
  if (contentType === 'figure') return figures
  if (contentType === 'battle') return battles as unknown as typeof figures
  throw new ApiError('VALIDATION_ERROR', `Unsupported review content_type: ${contentType}`)
}

/** Resolve next revision number for (contentType, contentId) atomically-ish. */
async function nextRevisionNumber(
  contentType: string,
  contentId: string,
): Promise<number> {
  const [latest] = await db
    .select({ n: contentRevisions.revisionNumber })
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.contentType, contentType),
        eq(contentRevisions.contentId, contentId),
      ),
    )
    .orderBy(desc(contentRevisions.revisionNumber))
    .limit(1)
  return (latest?.n ?? 0) + 1
}

/** Load an assignment (active rows only) or throw NOT_FOUND. */
async function getAssignmentById(id: string): Promise<ReviewAssignmentRow> {
  const row = await db.query.reviewAssignments.findFirst({
    where: and(eq(reviewAssignments.id, id), isNull(reviewAssignments.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Review assignment not found: ${id}`)
  return row
}

/** Guard: refuse to act on an already-completed assignment. */
function assertNotCompleted(row: ReviewAssignmentRow): void {
  if (row.status === 'completed') {
    throw new ApiError('CONFLICT', 'Review assignment is already completed')
  }
}

/** Guard: only the assigned reviewer can decide their own assignment. */
function assertReviewerOwns(row: ReviewAssignmentRow, reviewerId: string): void {
  if (row.reviewerId !== reviewerId) {
    throw new ApiError(
      'PERMISSION_DENIED',
      'This review assignment belongs to another reviewer',
    )
  }
}

// ── Queue ─────────────────────────────────────────────────────────────
/**
 * List a reviewer's assignments. Defaults to `pending` (the "inbox" view) but
 * accepts `status` to inspect in-progress / completed history.
 */
export async function getQueueForReviewer(
  reviewerId: string,
  input: QueueQuery,
): Promise<PaginatedAssignments> {
  const { status = 'pending', page, perPage } = input
  const offset = (page - 1) * perPage

  const whereExpr = and(
    eq(reviewAssignments.reviewerId, reviewerId),
    eq(reviewAssignments.status, status),
    isNull(reviewAssignments.deletedAt),
  )

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(reviewAssignments)
      .where(whereExpr)
      .orderBy(asc(reviewAssignments.assignedAt))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewAssignments)
      .where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

// ── Assign ────────────────────────────────────────────────────────────
/**
 * Create a new review assignment and bump the content's status to
 * `under_review` (only if it isn't already past that point — re-assigns of
 * an already-approved row stay approved). Batched so the assignment and the
 * status bump land together.
 */
export async function assignToReviewer(
  contentType: ReviewContentType,
  contentId: string,
  reviewerId: string,
  assignedBy: string,
): Promise<ReviewAssignmentRow> {
  const table = contentTable(contentType)

  const [content] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, contentId), isNull(table.deletedAt)))
    .limit(1)
  if (!content) {
    throw new ApiError('NOT_FOUND', `${contentType} not found: ${contentId}`)
  }

  // We always batch the insert + status bump so a partial failure leaves no
  // dangling assignment. Even if content is already under_review the no-op
  // update is cheap and keeps the code path uniform.
  const insert = db
    .insert(reviewAssignments)
    .values({
      contentType,
      contentId,
      reviewerId,
      assignedBy,
      status: 'pending',
      createdBy: assignedBy,
      updatedBy: assignedBy,
    })
    .returning()

  // Only push draft / needs_edit → under_review. Don't downgrade approved /
  // published rows just because a re-review was requested.
  const bump = db
    .update(table)
    .set({ status: 'under_review', updatedAt: new Date(), updatedBy: assignedBy })
    .where(
      and(
        eq(table.id, contentId),
        sql`${table.status} IN ('draft', 'needs_edit')`,
      ),
    )

  const [insertResult] = await db.batch([insert, bump])
  const inserted = (insertResult as ReviewAssignmentRow[])[0]
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to create review assignment')

  await auditLog.write({
    action: 'create',
    resourceType: 'review_assignment',
    resourceId: inserted.id,
    actorId: assignedBy,
    actorRole: 'admin',
    diff: { contentType, contentId, reviewerId },
  })

  return inserted
}

// ── Detail ────────────────────────────────────────────────────────────
/**
 * Hydrate an assignment with its content row + all citations attached to
 * that content. Access is restricted to the assigned reviewer; admins
 * holding `figures.review` may also peek (used by the admin dashboard).
 */
export async function getAssignmentDetail(
  id: string,
  viewerId: string,
): Promise<AssignmentDetail> {
  const assignment = await getAssignmentById(id)

  if (assignment.reviewerId !== viewerId) {
    // Admins / head reviewers can still inspect (read-only) — gate behind
    // `figures.review`, which the route guard also requires.
    const allowed = await hasPermission(viewerId, 'figures.review')
    if (!allowed) {
      throw new ApiError(
        'PERMISSION_DENIED',
        'You are not authorised to view this assignment',
      )
    }
  }

  const table = contentTable(assignment.contentType)
  const [contentRow] = await db
    .select()
    .from(table)
    .where(eq(table.id, assignment.contentId))
    .limit(1)

  const citationRows = await db
    .select()
    .from(citations)
    .where(
      and(
        eq(citations.contentType, assignment.contentType),
        eq(citations.contentId, assignment.contentId),
        isNull(citations.deletedAt),
      ),
    )
    .orderBy(asc(citations.createdAt))

  // Pull whitelist priority/active-flag for every distinct domain referenced
  // by the citations so the UI can flag rogue sources defensively (the AI
  // pipeline should already enforce the whitelist, but a stale row could
  // leak through — better to surface it loudly than silently trust).
  const domains = Array.from(
    new Set(
      citationRows
        .map((c) => (c.sourceDomain ?? hostFromUrl(c.sourceUrl) ?? '').toLowerCase())
        .filter((d): d is string => d.length > 0),
    ),
  )
  const whitelistRows = domains.length === 0
    ? []
    : await db
        .select({
          domain: whitelistDomains.domain,
          priority: whitelistDomains.priority,
          isActive: whitelistDomains.isActive,
        })
        .from(whitelistDomains)
        .where(
          and(
            inArray(whitelistDomains.domain, domains),
            isNull(whitelistDomains.deletedAt),
          ),
        )
  const whitelistMap = new Map<string, { priority: number; isActive: boolean }>()
  for (const w of whitelistRows) {
    whitelistMap.set(w.domain.toLowerCase(), { priority: w.priority, isActive: w.isActive })
  }
  const whitelistByCitation: Record<string, CitationWhitelistInfo> = {}
  for (const c of citationRows) {
    const dom = (c.sourceDomain ?? hostFromUrl(c.sourceUrl) ?? '').toLowerCase() || null
    const meta = dom ? whitelistMap.get(dom) : undefined
    whitelistByCitation[c.id] = {
      citationId: c.id,
      domain: dom,
      priority: meta?.isActive ? meta.priority : null,
      onWhitelist: Boolean(meta?.isActive),
    }
  }

  // First-ever revision (`action='created'`) is the original AI draft snapshot
  // — handy for diffing the live row against what the AI initially produced.
  const [originalRevision] = await db
    .select()
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.contentType, assignment.contentType),
        eq(contentRevisions.contentId, assignment.contentId),
        eq(contentRevisions.action, 'created'),
      ),
    )
    .orderBy(asc(contentRevisions.revisionNumber))
    .limit(1)

  return {
    assignment,
    content: (contentRow as Record<string, unknown>) ?? null,
    citations: citationRows,
    whitelistByCitation,
    originalRevision: originalRevision ?? null,
  }
}

/** Cheap URL → host parser; returns null for malformed URLs. */
function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ── Notifications ─────────────────────────────────────────────────────
/**
 * Fire-and-forget notification to the admin/user who originally created the
 * content row (`figures.created_by`). On failure we log + swallow — a Redis
 * outage or a missing `createdBy` (legacy rows) must never break the review
 * decision pipeline.
 *
 * Returns silently if there's no recipient (system-seeded rows have null
 * createdBy).
 */
async function notifyAuthor(args: {
  contentType: string
  contentId: string
  reviewerId: string
  decision: 'approve' | 'reject' | 'request_edit'
  reason?: string | null
}): Promise<void> {
  try {
    // Figures and battles live in different tables with slightly different
    // name columns. Pull the row for the right one separately so Drizzle's
    // type inference stays sound — the union-via-cast trick was brittle.
    let createdBy: string | null = null
    let contentLabel: string | null = null
    if (args.contentType === 'figure') {
      const [row] = await db
        .select({
          createdBy: figures.createdBy,
          nameId: figures.nameShortId,
          nameAr: figures.nameShortAr,
          nameFullId: figures.nameFullId,
        })
        .from(figures)
        .where(eq(figures.id, args.contentId))
        .limit(1)
      createdBy = row?.createdBy ?? null
      contentLabel = row?.nameId || row?.nameFullId || row?.nameAr || null
    } else if (args.contentType === 'battle') {
      const [row] = await db
        .select({
          createdBy: battles.createdBy,
          nameId: battles.nameId,
          nameAr: battles.nameAr,
        })
        .from(battles)
        .where(eq(battles.id, args.contentId))
        .limit(1)
      createdBy = row?.createdBy ?? null
      contentLabel = row?.nameId || row?.nameAr || null
    }

    if (!createdBy) return
    if (createdBy === args.reviewerId) return // don't self-notify

    const [reviewer] = await db
      .select({ fullName: users.fullName, displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, args.reviewerId))
      .limit(1)
    const reviewerLabel =
      reviewer?.displayName || reviewer?.fullName || reviewer?.email || 'ustadz reviewer'
    const labelText = contentLabel || (args.contentType === 'figure' ? 'tokoh' : 'sirah')

    const noun = args.contentType === 'figure' ? 'tokoh' : 'sirah'
    let title: string
    let body: string
    if (args.decision === 'approve') {
      title = `Draf "${labelText}" disetujui`
      body = `Draf ${noun} ${labelText} disetujui dan dipublikasikan oleh ustadz ${reviewerLabel}.`
    } else if (args.decision === 'reject') {
      title = `Draf "${labelText}" ditolak`
      body = `Draf ${noun} ${labelText} ditolak oleh ustadz ${reviewerLabel}.${args.reason ? ` Alasan: ${args.reason}` : ''}`
    } else {
      title = `Draf "${labelText}" perlu perbaikan`
      body = `Draf ${noun} ${labelText} membutuhkan perbaikan dari ustadz ${reviewerLabel}.${args.reason ? ` Alasan: ${args.reason}` : ''}`
    }

    const actionUrl =
      args.contentType === 'figure'
        ? `/admin/figures/${args.contentId}`
        : `/admin/battles/${args.contentId}`

    await notificationService.create({
      userId: createdBy,
      type: `review_${args.decision}`,
      title,
      body,
      actionUrl,
    })
  } catch (err) {
    console.error('[review.service] notifyAuthor failed', {
      contentType: args.contentType,
      contentId: args.contentId,
      decision: args.decision,
      err,
    })
  }
}

// ── Approve ───────────────────────────────────────────────────────────
/**
 * Approve the content. Transitions:
 *   - assignment.status: pending|in_progress → completed (decision='approve')
 *   - content.status: → published (skips 'approved' — see §5c.2: the reviewer
 *     is the final gate, no separate publish step), publishedAt: → now()
 *
 * Optional `edits` payload: when the reviewer corrected the AI draft before
 * approving, the patch is applied to the content row AND captured as a
 * `content_revisions` row with action='edited_manual' BEFORE the approval
 * revision. The original AI draft (revision_number 1, action='created') is
 * preserved untouched — that's the entire point of the immutable revisions
 * log.
 *
 * (§5c.6 mentions multi-reviewer thresholds — for now we approve on the
 * first approve. Threshold logic lives at the policy layer, TBD.)
 */
export async function approve(
  id: string,
  reviewerId: string,
  edits?: ReviewerEdits | null,
): Promise<ReviewAssignmentRow> {
  const assignment = await getAssignmentById(id)
  assertReviewerOwns(assignment, reviewerId)
  assertNotCompleted(assignment)

  const now = new Date()
  const table = contentTable(assignment.contentType)
  const cleanEdits = sanitiseEdits(assignment.contentType, edits)
  const hasEdits = cleanEdits !== null && Object.keys(cleanEdits).length > 0

  // Take a "before" snapshot so the edit revision can persist a diff for audit.
  // The batch below would update the row before we can read it, so we snapshot
  // here. Soft-deleted rows would've already failed assertNotCompleted.
  let beforeSnapshot: Record<string, unknown> | null = null
  if (hasEdits) {
    const [row] = await db.select().from(table).where(eq(table.id, assignment.contentId)).limit(1)
    beforeSnapshot = (row as Record<string, unknown>) ?? null
  }

  const baseRevisionNumber = await nextRevisionNumber(
    assignment.contentType,
    assignment.contentId,
  )
  // Revision-number reservations:
  //   - if hasEdits: edited_manual @ N, approved @ N+1, published @ N+2
  //   - otherwise:   approved @ N,       published @ N+1
  const editRevisionNumber = hasEdits ? baseRevisionNumber : null
  const approvalRevisionNumber = hasEdits ? baseRevisionNumber + 1 : baseRevisionNumber
  const publishRevisionNumber = approvalRevisionNumber + 1

  // The assignment update is shared by both branches.
  const assignmentUpdate = db
    .update(reviewAssignments)
    .set({
      decision: 'approve' as const,
      status: 'completed' as const,
      decisionAt: now,
      updatedAt: now,
      updatedBy: reviewerId,
    })
    .where(eq(reviewAssignments.id, id))
    .returning()

  // Content row patch — varies by hasEdits.
  const contentPatch = hasEdits && cleanEdits
    ? db
        .update(table)
        .set({
          ...(cleanEdits as Partial<typeof figures.$inferInsert>),
          status: 'published' as const,
          publishedAt: now,
          updatedAt: now,
          updatedBy: reviewerId,
        })
        .where(eq(table.id, assignment.contentId))
    : db
        .update(table)
        .set({
          status: 'published' as const,
          publishedAt: now,
          updatedAt: now,
          updatedBy: reviewerId,
        })
        .where(eq(table.id, assignment.contentId))

  const approvedRevision = db.insert(contentRevisions).values({
    contentType: assignment.contentType,
    contentId: assignment.contentId,
    revisionNumber: approvalRevisionNumber,
    action: 'approved' as const,
    actorId: reviewerId,
    actorRole: 'reviewer' as const,
  })
  const publishedRevision = db.insert(contentRevisions).values({
    contentType: assignment.contentType,
    contentId: assignment.contentId,
    revisionNumber: publishRevisionNumber,
    action: 'published' as const,
    actorId: reviewerId,
    actorRole: 'reviewer' as const,
  })

  // db.batch preserves ordering — the manual edit lands BEFORE the approval
  // revision so the log reads chronologically.
  let results: unknown[]
  if (hasEdits && cleanEdits && editRevisionNumber !== null) {
    const editRevision = db.insert(contentRevisions).values({
      contentType: assignment.contentType,
      contentId: assignment.contentId,
      revisionNumber: editRevisionNumber,
      action: 'edited_manual' as const,
      actorId: reviewerId,
      actorRole: 'reviewer' as const,
      diff: {
        before: pickEditedFields(beforeSnapshot, cleanEdits),
        after: cleanEdits,
      },
    })
    results = await db.batch([
      assignmentUpdate,
      editRevision,
      contentPatch,
      approvedRevision,
      publishedRevision,
    ])
  } else {
    results = await db.batch([
      assignmentUpdate,
      contentPatch,
      approvedRevision,
      publishedRevision,
    ])
  }

  const updated = (results[0] as ReviewAssignmentRow[])[0]
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to record approval')

  await auditLog.write({
    action: 'update',
    resourceType: 'review_assignment',
    resourceId: id,
    actorId: reviewerId,
    actorRole: 'reviewer',
    diff: {
      decision: 'approve',
      contentType: assignment.contentType,
      contentId: assignment.contentId,
      edited: hasEdits,
    },
  })

  await notifyAuthor({
    contentType: assignment.contentType,
    contentId: assignment.contentId,
    reviewerId,
    decision: 'approve',
  })

  return updated
}

/**
 * Drop empty / unknown keys from a reviewer edits payload. Only fields that
 * belong to the requested content type are kept; everything else is stripped
 * so a malicious payload can't sneak `slug` or `categoryId` through.
 */
function sanitiseEdits(
  contentType: string,
  edits: ReviewerEdits | null | undefined,
): Record<string, string | null> | null {
  if (!edits || typeof edits !== 'object') return null

  const FIGURE_FIELDS = new Set([
    'nameFullId',
    'nameFullAr',
    'nameShortId',
    'nameShortAr',
    'summaryId',
    'summaryAr',
    'biographyId',
    'biographyAr',
  ])
  const BATTLE_FIELDS = new Set([
    'nameId',
    'nameAr',
    'summaryId',
    'summaryAr',
    'descriptionId',
    'descriptionAr',
  ])
  const allowed = contentType === 'figure' ? FIGURE_FIELDS : BATTLE_FIELDS

  const out: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(edits)) {
    if (!allowed.has(key)) continue
    if (value === undefined) continue
    if (value === null) {
      out[key] = null
      continue
    }
    if (typeof value !== 'string') continue
    out[key] = value
  }
  return out
}

/** Pluck the same set of keys from the before-snapshot for diff logging. */
function pickEditedFields(
  before: Record<string, unknown> | null,
  edits: Record<string, string | null>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!before) return out
  for (const key of Object.keys(edits)) {
    out[key] = before[key] ?? null
  }
  return out
}

// ── Reject ────────────────────────────────────────────────────────────
/**
 * Reject the content. Assignment closes with decision='reject' AND the
 * parent content row flips to `status='archived'` — the reviewer's verdict
 * is "this draft shouldn't be published as-is", and we don't want orphan
 * drafts sitting at status='under_review' forever. Admin can always restore
 * via the trash flow if a rejection was in error.
 */
export async function reject(
  id: string,
  reviewerId: string,
  reason: string,
): Promise<ReviewAssignmentRow> {
  const assignment = await getAssignmentById(id)
  assertReviewerOwns(assignment, reviewerId)
  assertNotCompleted(assignment)

  const now = new Date()
  const table = contentTable(assignment.contentType)
  const revisionNumber = await nextRevisionNumber(
    assignment.contentType,
    assignment.contentId,
  )

  const [updateResult] = await db.batch([
    db
      .update(reviewAssignments)
      .set({
        decision: 'reject',
        status: 'completed',
        decisionAt: now,
        decisionNotes: reason,
        updatedAt: now,
        updatedBy: reviewerId,
      })
      .where(eq(reviewAssignments.id, id))
      .returning(),
    db
      .update(table)
      .set({
        status: 'archived',
        updatedAt: now,
        updatedBy: reviewerId,
      })
      .where(eq(table.id, assignment.contentId)),
    db.insert(contentRevisions).values({
      contentType: assignment.contentType,
      contentId: assignment.contentId,
      revisionNumber,
      action: 'rejected',
      actorId: reviewerId,
      actorRole: 'reviewer',
      notes: reason,
    }),
  ])

  const updated = (updateResult as ReviewAssignmentRow[])[0]
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to record rejection')

  await auditLog.write({
    action: 'update',
    resourceType: 'review_assignment',
    resourceId: id,
    actorId: reviewerId,
    actorRole: 'reviewer',
    diff: {
      decision: 'reject',
      reason,
      contentType: assignment.contentType,
      contentId: assignment.contentId,
    },
  })

  await notifyAuthor({
    contentType: assignment.contentType,
    contentId: assignment.contentId,
    reviewerId,
    decision: 'reject',
    reason,
  })

  return updated
}

// ── Request edit ──────────────────────────────────────────────────────
/**
 * Request an AI-assisted edit. The reviewer writes a natural-language
 * instruction (§5c.5); we persist it as a `content_revisions` row with
 * `action='edited_ai'` and bump the content back to `needs_edit`. The actual
 * AI rewrite runs async — we enqueue a QStash job here.
 *
 * NOTE: QStash publishing is left as a TODO for the AI integration swarm —
 * see docs/ARCHITECTURE.md §4 (Worker Strategy). For now we just log the
 * intent so the rest of the workflow is testable end-to-end.
 */
export async function requestEdit(
  id: string,
  reviewerId: string,
  instruction: string,
): Promise<ReviewAssignmentRow> {
  const assignment = await getAssignmentById(id)
  assertReviewerOwns(assignment, reviewerId)
  assertNotCompleted(assignment)

  const now = new Date()
  const table = contentTable(assignment.contentType)
  const revisionNumber = await nextRevisionNumber(
    assignment.contentType,
    assignment.contentId,
  )

  const [updateResult, , revisionResult] = await db.batch([
    db
      .update(reviewAssignments)
      .set({
        decision: 'request_edit',
        status: 'completed',
        decisionAt: now,
        decisionNotes: instruction,
        updatedAt: now,
        updatedBy: reviewerId,
      })
      .where(eq(reviewAssignments.id, id))
      .returning(),
    db
      .update(table)
      .set({
        status: 'needs_edit',
        updatedAt: now,
        updatedBy: reviewerId,
      })
      .where(eq(table.id, assignment.contentId)),
    db
      .insert(contentRevisions)
      .values({
        contentType: assignment.contentType,
        contentId: assignment.contentId,
        revisionNumber,
        action: 'edited_ai',
        actorId: reviewerId,
        actorRole: 'reviewer',
        aiInstruction: instruction,
      })
      .returning(),
  ])

  const updated = (updateResult as ReviewAssignmentRow[])[0]
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to record edit request')

  const revisionRow = (revisionResult as (typeof contentRevisions.$inferSelect)[])[0]

  // TODO(ai-swarm): publish a QStash job (e.g. `publishJob('content-ai-edit', { revisionId, ... })`)
  // so a worker picks up the instruction, regenerates the content, writes a
  // follow-up revision, and pushes the assignment back to `under_review`.
  // Left as a no-op for now — see docs/IDEAS.md §5c.5 step 3-6.
  console.log('[review] AI edit requested (job not yet enqueued)', {
    assignmentId: id,
    contentType: assignment.contentType,
    contentId: assignment.contentId,
    revisionId: revisionRow?.id,
    instructionPreview: instruction.slice(0, 120),
  })

  await auditLog.write({
    action: 'update',
    resourceType: 'review_assignment',
    resourceId: id,
    actorId: reviewerId,
    actorRole: 'reviewer',
    diff: {
      decision: 'request_edit',
      instruction,
      contentType: assignment.contentType,
      contentId: assignment.contentId,
    },
  })

  await notifyAuthor({
    contentType: assignment.contentType,
    contentId: assignment.contentId,
    reviewerId,
    decision: 'request_edit',
    reason: instruction,
  })

  return updated
}

// ── Default export (namespaced) ───────────────────────────────────────
export const reviewService = {
  getQueueForReviewer,
  assignToReviewer,
  getAssignmentDetail,
  approve,
  reject,
  requestEdit,
}
