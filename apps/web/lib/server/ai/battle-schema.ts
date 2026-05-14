// Zod schema describing the AI extraction output for a battle (ghazwah,
// sariyyah, or futuhat). Mirrors the columns on `battles` (DATABASE.md §6)
// that a crawler can plausibly populate; reviewer fills the rest by hand.
//
// Anti-hallucination contract (parallels `lib/server/ai/extract.ts` for
// figures, see docs/IDEAS.md §4 + §4b):
//   - The LLM may only use facts present in the supplied sources.
//   - Unknown fields MUST be returned as null.
//   - Every filled field MUST point at a source URL via the `citations` array.
//
// Resolution responsibilities live on the worker, not the LLM:
//   - `locationSlug` is a free-form slug guess (lowercase ascii kebab) the
//     worker maps to a `locations.id` (LEFT JOIN). When no match, the worker
//     leaves `locationId` null and appends the LLM's suggested name to
//     `eventDateNotes` so the reviewer can create/link the location.
//   - `commanderName` is free-form (Arabic or transliteration). The worker
//     resolves to a `figures.id` via ILIKE on `nameFullAr` / `nameFullId`.
//     If no match, `commanderId` stays null.

import { z } from 'zod'

export const battleExtractionSchema = z.object({
  // ── Names (required by DB) ──────────────────────────────────────────
  nameAr: z.string().min(2).max(160),
  nameId: z.string().min(2).max(160),

  // ── Type (required) ─────────────────────────────────────────────────
  type: z.enum(['ghazwah', 'sariyyah', 'futuhat']),

  // ── Dates ───────────────────────────────────────────────────────────
  eventDateAh: z.number().int().nullable(),
  eventDateCe: z.number().int().nullable(),
  eventDatePrecision: z
    .enum(['year', 'month', 'day', 'approximate', 'range'])
    .nullable(),
  eventDateNotes: z.string().max(400).nullable(),

  // ── Location (resolved on the worker) ───────────────────────────────
  /** Slug guess (lower-case kebab-case). Worker matches against locations.slug. */
  locationSlug: z.string().max(120).nullable(),

  // ── Commander (resolved on the worker) ──────────────────────────────
  /** Free-text name. Worker ILIKE-matches against figures.nameFullAr/Id. */
  commanderName: z.string().max(160).nullable(),

  // ── Forces & outcome ────────────────────────────────────────────────
  opponentForce: z.string().max(200).nullable(),
  muslimCount: z.number().int().nullable(),
  opponentCount: z.number().int().nullable(),
  outcome: z.enum(['victory', 'defeat', 'truce', 'partial']).nullable(),
  casualtiesMuslim: z.number().int().nullable(),
  casualtiesOpponent: z.number().int().nullable(),

  // ── Narrative (Indonesian only — Arabic backfilled manually) ────────
  strategyId: z.string().max(2000).nullable(),
  narrativeId: z.string().max(4000).nullable(),
  significanceId: z.string().max(2000).nullable(),

  // ── Citations (per-fact provenance) ─────────────────────────────────
  citations: z
    .array(
      z.object({
        sourceUrl: z.string().url(),
        sourceExcerptId: z.string().max(600),
      }),
    )
    .max(8),
})

export type BattleExtractionResult = z.infer<typeof battleExtractionSchema>

/** Subset of the schema with the citations array stripped — the shape that
 *  maps directly onto the `battles` row patch. */
export type BattleExtractionData = Omit<BattleExtractionResult, 'citations'>
