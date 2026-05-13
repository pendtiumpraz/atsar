// "Lengkapi, jangan timpa" merge engine — see IDEAS.md §5.
//
// Compares an extracted figure record against the existing `figures` row (if
// any) and produces a patch + conflict list:
//   - action='create'   → no row existed yet, patch is the full insert payload.
//   - action='append'   → row existed; patch fills ONLY columns currently null
//                         or empty. No existing value is ever overwritten.
//   - action='conflict' → row existed AND the extractor's value disagrees with
//                         a populated column. The conflicting fields are
//                         returned for human review; non-conflicting fields
//                         that can still be appended go into `patch`.
//
// The action is the dominant verdict: a single conflict promotes the whole
// merge to 'conflict' so the admin sees the disagreement, even when other
// fields could be appended cleanly.

import type { figures } from '@athar/db/schema'
import type { ExtractedFigure } from './extract.js'

/** Subset of the `figures` row we know how to merge from extracted text. */
export type FigureRow = typeof figures.$inferSelect

/** Result of one field-level comparison. */
export interface ConflictField {
  field: keyof FigureRow
  existing: unknown
  proposed: unknown
}

export type MergeAction = 'create' | 'append' | 'conflict'

export interface MergeResult {
  action: MergeAction
  /** Columns we are safe to update (existing was null/empty). */
  patch: Partial<FigureRow>
  /** Fields where existing != proposed AND existing is populated. */
  conflicts: ConflictField[]
}

// ─── helpers ──────────────────────────────────────────────────────────
function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

function normaliseString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

/**
 * Equality check that is permissive about whitespace/case for strings but
 * strict for everything else. Used to decide whether a populated existing
 * field actually contradicts the extracted value or merely restates it.
 */
function looselyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
  if (typeof a === 'number' && typeof b === 'number') return a === b
  return false
}

/**
 * Per-field merge: yields either a patch entry, a conflict, or nothing
 * (existing already equals proposed, or proposed is empty).
 */
function mergeField<K extends keyof FigureRow>(
  field: K,
  existing: FigureRow[K] | null | undefined,
  proposed: FigureRow[K] | null | undefined,
): { patch?: Partial<FigureRow>; conflict?: ConflictField } {
  if (isEmpty(proposed)) return {}
  if (isEmpty(existing)) {
    return { patch: { [field]: proposed } as Partial<FigureRow> }
  }
  if (looselyEqual(existing, proposed)) return {}
  return {
    conflict: {
      field,
      existing,
      proposed,
    },
  }
}

/**
 * Flatten an `ExtractedFigure` into the same shape as a `figures` row so we
 * can compare column-by-column. Only fields the LLM is allowed to populate
 * are included; the rest (status, slug, categoryId, …) are decided by the
 * caller (job handler) and never overwritten here.
 */
function projectExtracted(e: ExtractedFigure): Partial<FigureRow> {
  const out: Partial<FigureRow> = {}
  out.nameFullAr = normaliseString(e.name_full_ar) ?? undefined
  out.nameFullId = normaliseString(e.name_full_id) ?? undefined
  if (e.kunyah_ar) out.kunyahAr = normaliseString(e.kunyah_ar) ?? undefined
  if (e.kunyah_id) out.kunyahId = normaliseString(e.kunyah_id) ?? undefined
  if (e.laqab_ar) out.laqabAr = normaliseString(e.laqab_ar) ?? undefined
  if (e.laqab_id) out.laqabId = normaliseString(e.laqab_id) ?? undefined
  if (e.gender) out.gender = e.gender

  if (e.birth) {
    if (e.birth.year_ah != null) out.birthDateAh = e.birth.year_ah
    if (e.birth.year_ce != null) out.birthDateCe = e.birth.year_ce
    if (e.birth.precision) out.birthDatePrecision = e.birth.precision
    if (e.birth.notes) out.birthDateNotes = normaliseString(e.birth.notes) ?? undefined
  }
  if (e.death) {
    if (e.death.year_ah != null) out.deathDateAh = e.death.year_ah
    if (e.death.year_ce != null) out.deathDateCe = e.death.year_ce
    if (e.death.precision) out.deathDatePrecision = e.death.precision
    if (e.death.notes) out.deathDateNotes = normaliseString(e.death.notes) ?? undefined
  }
  if (e.summary_ar) out.summaryAr = normaliseString(e.summary_ar) ?? undefined
  if (e.summary_id) out.summaryId = normaliseString(e.summary_id) ?? undefined
  return out
}

/**
 * Compute the merge plan for a single extracted figure.
 *
 * Caller responsibility:
 *   - Resolve `existing` via slug / `name_full_ar` lookup before calling.
 *   - For action='create', supply `slug`, `categoryId`, etc. — those are NOT
 *     in this patch by design (extractor is not authoritative for them).
 *   - For action='conflict', persist the conflict list into
 *     `contentRevisions.notes` (or similar) so a reviewer can adjudicate.
 */
export function appendMergeFigure(
  existing: FigureRow | null,
  extracted: ExtractedFigure,
): MergeResult {
  const proposed = projectExtracted(extracted)

  // No existing row → full create, every populated proposed field is in patch.
  if (!existing) {
    return {
      action: 'create',
      patch: proposed,
      conflicts: [],
    }
  }

  const patch: Partial<FigureRow> = {}
  const conflicts: ConflictField[] = []

  for (const key of Object.keys(proposed) as Array<keyof FigureRow>) {
    const result = mergeField(
      key,
      existing[key] as FigureRow[typeof key] | null | undefined,
      proposed[key] as FigureRow[typeof key] | null | undefined,
    )
    if (result.patch) Object.assign(patch, result.patch)
    if (result.conflict) conflicts.push(result.conflict)
  }

  const action: MergeAction =
    conflicts.length > 0
      ? 'conflict'
      : Object.keys(patch).length > 0
        ? 'append'
        : // Nothing to do — existing already covers everything. Surface as
          // 'append' with an empty patch so the caller can skip cheaply.
          'append'

  return { action, patch, conflicts }
}

/** Pretty-print conflicts for `contentRevisions.notes`. */
export function formatConflictsForReview(conflicts: ConflictField[]): string {
  if (conflicts.length === 0) return ''
  const lines = conflicts.map(
    (c) =>
      `- ${String(c.field)}: existing=${JSON.stringify(c.existing)} ` +
      `vs proposed=${JSON.stringify(c.proposed)}`,
  )
  return `Doc-analyzer detected ${conflicts.length} conflict(s):\n${lines.join('\n')}`
}
