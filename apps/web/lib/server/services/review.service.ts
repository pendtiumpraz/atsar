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

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@athar/db'
import {
  battles,
  citations,
  contentRevisions,
  figures,
  reviewAssignments,
} from '@athar/db/schema'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'
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

export interface AssignmentDetail {
  assignment: ReviewAssignmentRow
  content: Record<string, unknown> | null
  citations: (typeof citations.$inferSelect)[]
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

  return {
    assignment,
    content: (contentRow as Record<string, unknown>) ?? null,
    citations: citationRows,
  }
}

// ── Approve ───────────────────────────────────────────────────────────
/**
 * Approve the content. Transitions:
 *   - assignment.status: pending|in_progress → completed (decision='approve')
 *   - content.status: → approved, publishedAt: → now()
 * (Note: §5c.6 mentions multi-reviewer thresholds — for now we approve on the
 * first approve. Threshold logic lives at the policy layer, TBD.)
 */
export async function approve(
  id: string,
  reviewerId: string,
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
        decision: 'approve',
        status: 'completed',
        decisionAt: now,
        updatedAt: now,
        updatedBy: reviewerId,
      })
      .where(eq(reviewAssignments.id, id))
      .returning(),
    db
      .update(table)
      .set({
        status: 'approved',
        publishedAt: now,
        updatedAt: now,
        updatedBy: reviewerId,
      })
      .where(eq(table.id, assignment.contentId)),
    db.insert(contentRevisions).values({
      contentType: assignment.contentType,
      contentId: assignment.contentId,
      revisionNumber,
      action: 'approved',
      actorId: reviewerId,
      actorRole: 'reviewer',
    }),
  ])

  const updated = (updateResult as ReviewAssignmentRow[])[0]
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
    },
  })

  return updated
}

// ── Reject ────────────────────────────────────────────────────────────
/**
 * Reject the content. Assignment closes with decision='reject'; the parent
 * content's `status` is intentionally NOT bumped — admin decides whether to
 * archive / re-route / re-extract.
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
