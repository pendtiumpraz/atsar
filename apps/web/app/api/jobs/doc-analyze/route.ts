// QStash job: doc-analyze.
//
// Consumes the payload published by `POST /api/v1/admin/doc-analyze` and
// runs the AI extraction → "lengkapi, jangan timpa" merge cycle (IDEAS.md §5).
//
// Flow:
//   1. Resolve text — inline payload or future fetch-by-uploadKey.
//   2. `analyzeDocText` → list of ExtractedFigure.
//   3. For each, best-effort match to an existing `figures` row via
//      slug guess or full Arabic name.
//   4. `appendMergeFigure` produces the merge plan.
//   5. Apply:
//        - 'create'   → insert as `draft` (reviewer assignment is TODO).
//        - 'append'   → update only the null/empty columns.
//        - 'conflict' → insert a `content_revisions` row with `edited_ai`
//                       action and the conflict notes; do NOT touch
//                       the existing data.
//   6. Audit-log everything.

import { and, eq, ilike, isNull, or } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import {
  contentRevisions,
  figureCategories,
  figures,
} from '@athar/db/schema'

import { withSignature } from '../_lib/with-signature'
import {
  analyzeDocText,
  type ExtractedFigure,
} from '@/lib/server/doc-analyzer/extract'
import {
  appendMergeFigure,
  formatConflictsForReview,
  type FigureRow,
  type MergeResult,
} from '@/lib/server/doc-analyzer/merge'
import { auditLog } from '@/lib/server/services/audit.service'

export const runtime = 'nodejs'
// Doc analysis can be slow with large PDFs; Vercel Pro caps at 300s.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const PayloadSchema = z.object({
  text: z.string().nullable().optional(),
  uploadKey: z.string().nullable().optional(),
  categoryHint: z.string().nullable().optional(),
  requestedBy: z.string().uuid(),
  requestedAt: z.string().optional(),
})

type Payload = z.infer<typeof PayloadSchema>

/**
 * Slugify in the same simple style used across the app — lowercase, dashes,
 * strip diacritics. Good enough for a "have we seen this person before?"
 * lookup; not authoritative.
 */
function naiveSlug(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Resolve text content for the analyzer. Inline text wins; otherwise we
 * surface a TODO for the future PDF fetcher rather than silently failing.
 */
async function resolveDocText(payload: Payload): Promise<string> {
  if (payload.text && payload.text.trim().length > 0) return payload.text
  if (payload.uploadKey) {
    // TODO: fetch + parse the file referenced by uploadKey.
    //   - For text/plain: download from storage and return as-is.
    //   - For PDF: pipe through `pdf-parse` (not yet installed) and extract.
    //   - For docx: use `mammoth` or similar.
    // Until those are wired in we deliberately fail loudly so admins know
    // the upload path isn't usable yet (inline text still works).
    throw new Error(
      `doc-analyze: uploadKey path not yet implemented (key=${payload.uploadKey}); ` +
        `supply inline text or extend resolveDocText`,
    )
  }
  throw new Error('doc-analyze: payload had neither text nor uploadKey')
}

/**
 * Best-effort lookup of an existing figure for the extracted candidate.
 * Returns null when no plausible match is found — callers treat that as a
 * "create" verdict.
 */
async function findExistingFigure(
  extracted: ExtractedFigure,
): Promise<FigureRow | null> {
  const slugGuess = naiveSlug(extracted.name_full_id || extracted.name_full_ar)
  const conditions = [
    slugGuess.length > 0 ? eq(figures.slug, slugGuess) : null,
    extracted.name_full_ar
      ? eq(figures.nameFullAr, extracted.name_full_ar)
      : null,
    extracted.name_full_id
      ? ilike(figures.nameFullId, extracted.name_full_id)
      : null,
  ].filter((c): c is NonNullable<typeof c> => c !== null)

  if (conditions.length === 0) return null

  const rows = await db
    .select()
    .from(figures)
    .where(and(isNull(figures.deletedAt), or(...conditions)))
    .limit(1)

  return rows[0] ?? null
}

/** Look up the figure_categories.id we should insert new drafts under. */
async function resolveCategoryId(hint: string | null | undefined): Promise<string> {
  const slug = hint && hint.length > 0 ? hint : 'sahabat'
  const rows = await db
    .select({ id: figureCategories.id })
    .from(figureCategories)
    .where(
      and(eq(figureCategories.slug, slug), isNull(figureCategories.deletedAt)),
    )
    .limit(1)
  if (rows[0]) return rows[0].id

  // Fall back to "sahabat" if hint didn't resolve.
  const fallback = await db
    .select({ id: figureCategories.id })
    .from(figureCategories)
    .where(
      and(eq(figureCategories.slug, 'sahabat'), isNull(figureCategories.deletedAt)),
    )
    .limit(1)
  if (fallback[0]) return fallback[0].id

  throw new Error('doc-analyze: no figure_categories rows seeded')
}

interface ApplyOutcome {
  action: MergeResult['action']
  figureId: string | null
  conflicts: number
}

/**
 * Apply a single merge plan to the database. Each branch records the side
 * effect in `content_revisions` so reviewers have an immutable audit trail.
 */
async function applyMerge(
  extracted: ExtractedFigure,
  existing: FigureRow | null,
  plan: MergeResult,
  categoryId: string,
  actorId: string,
  modelLabel: string,
): Promise<ApplyOutcome> {
  // ── CREATE ───────────────────────────────────────────────────────────
  if (plan.action === 'create') {
    const slug = naiveSlug(extracted.name_full_id || extracted.name_full_ar)
    const inserted = await db
      .insert(figures)
      .values({
        slug:
          slug.length > 0
            ? `${slug}-${Date.now().toString(36)}`
            : `figure-${Date.now().toString(36)}`,
        categoryId,
        gender: extracted.gender ?? 'male',
        nameFullAr: extracted.name_full_ar,
        nameFullId: extracted.name_full_id,
        kunyahAr: plan.patch.kunyahAr ?? null,
        kunyahId: plan.patch.kunyahId ?? null,
        laqabAr: plan.patch.laqabAr ?? null,
        laqabId: plan.patch.laqabId ?? null,
        birthDateAh: plan.patch.birthDateAh ?? null,
        birthDateCe: plan.patch.birthDateCe ?? null,
        birthDatePrecision: plan.patch.birthDatePrecision ?? null,
        birthDateNotes: plan.patch.birthDateNotes ?? null,
        deathDateAh: plan.patch.deathDateAh ?? null,
        deathDateCe: plan.patch.deathDateCe ?? null,
        deathDatePrecision: plan.patch.deathDatePrecision ?? null,
        deathDateNotes: plan.patch.deathDateNotes ?? null,
        summaryAr: plan.patch.summaryAr ?? null,
        summaryId: plan.patch.summaryId ?? null,
        status: 'draft',
        createdBy: actorId,
      })
      .returning({ id: figures.id })

    const id = inserted[0]?.id ?? null
    if (id) {
      await db.insert(contentRevisions).values({
        contentType: 'figure',
        contentId: id,
        revisionNumber: 1,
        action: 'created',
        actorId,
        actorRole: 'system',
        notes: 'Created by AI doc analyzer',
        aiModelUsed: modelLabel,
        diff: { created: true, source: 'doc_analyzer' },
      })
    }
    // TODO: auto-assign a reviewer (`review_assignments`) once the
    // reviewer-pool service exists. For now, the draft sits in the admin
    // queue waiting for manual assignment.
    return { action: 'create', figureId: id, conflicts: 0 }
  }

  // Anything beyond `create` requires an existing row.
  if (!existing) {
    // Should be unreachable — appendMergeFigure only returns append/conflict
    // when `existing` was non-null. Guard anyway.
    return { action: plan.action, figureId: null, conflicts: plan.conflicts.length }
  }

  // ── CONFLICT ─────────────────────────────────────────────────────────
  if (plan.action === 'conflict') {
    // Determine the next revision number for this figure. Cheap because
    // doc-analyze runs on a low cadence — if this becomes hot, cache it.
    const existingRevs = await db
      .select({ n: contentRevisions.revisionNumber })
      .from(contentRevisions)
      .where(
        and(
          eq(contentRevisions.contentType, 'figure'),
          eq(contentRevisions.contentId, existing.id),
        ),
      )
    const nextRev =
      existingRevs.reduce((m, r) => Math.max(m, r.n ?? 0), 0) + 1

    await db.insert(contentRevisions).values({
      contentType: 'figure',
      contentId: existing.id,
      revisionNumber: nextRev,
      action: 'edited_ai',
      actorId,
      actorRole: 'system',
      notes: formatConflictsForReview(plan.conflicts),
      aiModelUsed: modelLabel,
      diff: {
        // Encode proposed vs existing so a reviewer can adjudicate.
        conflicts: plan.conflicts.map((c) => ({
          field: c.field,
          existing: c.existing,
          proposed: c.proposed,
        })),
        // Append-safe fields we DIDN'T overwrite even though we could have —
        // surface them so the reviewer can apply them in one click later.
        appendable: plan.patch,
      },
    })
    return {
      action: 'conflict',
      figureId: existing.id,
      conflicts: plan.conflicts.length,
    }
  }

  // ── APPEND ───────────────────────────────────────────────────────────
  if (Object.keys(plan.patch).length === 0) {
    return { action: 'append', figureId: existing.id, conflicts: 0 }
  }
  await db
    .update(figures)
    .set({ ...plan.patch, updatedBy: actorId, updatedAt: new Date() })
    .where(eq(figures.id, existing.id))

  const existingRevs = await db
    .select({ n: contentRevisions.revisionNumber })
    .from(contentRevisions)
    .where(
      and(
        eq(contentRevisions.contentType, 'figure'),
        eq(contentRevisions.contentId, existing.id),
      ),
    )
  const nextRev = existingRevs.reduce((m, r) => Math.max(m, r.n ?? 0), 0) + 1

  await db.insert(contentRevisions).values({
    contentType: 'figure',
    contentId: existing.id,
    revisionNumber: nextRev,
    action: 'edited_ai',
    actorId,
    actorRole: 'system',
    notes: 'AI doc analyzer appended null/empty fields',
    aiModelUsed: modelLabel,
    diff: { appended: plan.patch },
  })
  return { action: 'append', figureId: existing.id, conflicts: 0 }
}

export const POST = withSignature(async (req) => {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json(
      {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON' },
      },
      { status: 422 },
    )
  }
  const parsed = PayloadSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid doc-analyze payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }
  const payload = parsed.data

  let text: string
  try {
    text = await resolveDocText(payload)
  } catch (err) {
    console.error('[jobs/doc-analyze] resolveDocText failed', err)
    // Non-2xx triggers QStash retry; that's fine for transient cases but a
    // missing parser would loop forever — log loudly and return 200 to
    // acknowledge instead.
    await auditLog.write({
      actorId: payload.requestedBy,
      actorRole: 'system',
      action: 'config_change',
      resourceType: 'doc_analyze_job',
      diff: {
        status: 'failed_to_resolve_text',
        error: err instanceof Error ? err.message : String(err),
        uploadKey: payload.uploadKey,
      },
    })
    return Response.json({ ok: false, reason: 'unresolved_text' })
  }

  const { figures: extractedFigures, meta } = await analyzeDocText(
    text,
    payload.requestedBy,
  )

  const modelLabel = `${meta.providerSlug}:${meta.modelId}${
    meta.fellBackToChat ? '(fallback-chat)' : ''
  }`

  const categoryId = await resolveCategoryId(payload.categoryHint)

  let created = 0
  let appended = 0
  let conflicted = 0
  const outcomes: ApplyOutcome[] = []

  for (const extracted of extractedFigures) {
    try {
      const existing = await findExistingFigure(extracted)
      const plan = appendMergeFigure(existing, extracted)
      const outcome = await applyMerge(
        extracted,
        existing,
        plan,
        categoryId,
        payload.requestedBy,
        modelLabel,
      )
      outcomes.push(outcome)
      if (outcome.action === 'create') created += 1
      else if (outcome.action === 'append') appended += 1
      else if (outcome.action === 'conflict') conflicted += 1
    } catch (err) {
      // One bad extraction shouldn't poison the batch.
      console.error('[jobs/doc-analyze] applyMerge failed', {
        name: extracted.name_full_id,
        err,
      })
    }
  }

  await auditLog.write({
    actorId: payload.requestedBy,
    actorRole: 'system',
    action: 'crawl_complete',
    resourceType: 'doc_analyze_job',
    diff: {
      extracted: extractedFigures.length,
      created,
      appended,
      conflicted,
      fellBackToChat: meta.fellBackToChat,
      modelLabel,
      durationMs: meta.durationMs,
      uploadKey: payload.uploadKey,
    },
  })

  return Response.json({
    ok: true,
    extracted: extractedFigures.length,
    created,
    appended,
    conflicted,
    fellBackToChat: meta.fellBackToChat,
  })
})
