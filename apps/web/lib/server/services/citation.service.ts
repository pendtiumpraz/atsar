// Citation service — business logic for the `citations` table.
// Citations are the anti-hallucination ground truth for AI-generated content.
// See docs/IDEAS.md §5c.3 (Mandatory Citation) and DATABASE.md §7.
//
// All CRUD goes through here; route handlers should NEVER touch Drizzle for
// citations directly.

import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { citations } from '@athar/db/schema'
import { ApiError } from '@/lib/server/api'
import { auditLog } from '@/lib/server/services/audit.service'

// ── Types ─────────────────────────────────────────────────────────────
export type CitationRow = typeof citations.$inferSelect
type CitationInsert = typeof citations.$inferInsert

/** Allowed content types citations can attach to. */
export type CitationContentType = 'figure' | 'battle' | 'location'

export interface CreateCitationInput {
  contentType: CitationContentType
  contentId: string
  fieldPath?: string | null
  sourceUrl: string
  sourceExcerptAr?: string | null
  sourceExcerptId?: string | null
  sourceLang?: 'ar' | 'id' | 'en' | null
  modelUsed?: string | null
  confidenceScore?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────
/**
 * Best-effort extraction of the host portion of a URL. Used to populate
 * `source_domain` so the whitelist index is meaningful. Returns null when
 * the URL fails to parse (the caller's zod validator should already have
 * caught malformed URLs).
 */
function extractDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

// ── List for a single content row ─────────────────────────────────────
/**
 * Return every active citation attached to `(contentType, contentId)`,
 * oldest first so reviewers see the original ground-truth source before any
 * later top-ups.
 */
export async function listForContent(
  contentType: CitationContentType,
  contentId: string,
): Promise<CitationRow[]> {
  return db
    .select()
    .from(citations)
    .where(
      and(
        eq(citations.contentType, contentType),
        eq(citations.contentId, contentId),
        isNull(citations.deletedAt),
      ),
    )
    .orderBy(asc(citations.createdAt))
}

// ── Create ────────────────────────────────────────────────────────────
export async function create(
  input: CreateCitationInput,
  actorId: string,
): Promise<CitationRow> {
  const values: CitationInsert = {
    contentType: input.contentType,
    contentId: input.contentId,
    fieldPath: input.fieldPath ?? null,
    sourceUrl: input.sourceUrl,
    sourceDomain: extractDomain(input.sourceUrl),
    sourceExcerptAr: input.sourceExcerptAr ?? null,
    sourceExcerptId: input.sourceExcerptId ?? null,
    sourceLang: input.sourceLang ?? null,
    modelUsed: input.modelUsed ?? null,
    confidenceScore: input.confidenceScore ?? null,
    extractedAt: new Date(),
    createdBy: actorId,
    updatedBy: actorId,
  }

  const [inserted] = await db.insert(citations).values(values).returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert citation')

  await auditLog.write({
    action: 'create',
    resourceType: 'citation',
    resourceId: inserted.id,
    actorId,
    diff: { after: inserted },
  })

  return inserted
}

// ── Soft delete ───────────────────────────────────────────────────────
export async function softDelete(id: string, actorId: string): Promise<void> {
  const row = await db.query.citations.findFirst({
    where: and(eq(citations.id, id), isNull(citations.deletedAt)),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Citation not found: ${id}`)

  await db
    .update(citations)
    .set({ deletedAt: new Date(), deletedBy: actorId, updatedBy: actorId })
    .where(eq(citations.id, id))

  await auditLog.write({
    action: 'soft_delete',
    resourceType: 'citation',
    resourceId: id,
    actorId,
    diff: { contentType: row.contentType, contentId: row.contentId },
  })
}

// ── Default export (namespaced) ───────────────────────────────────────
export const citationService = {
  listForContent,
  create,
  softDelete,
}
