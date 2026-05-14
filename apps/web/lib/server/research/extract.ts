// LLM structured-extraction step of the Deep Research pipeline.
//
// Given a figure name and a handful of source pages (raw HTML or stripped
// text), call the registered `agent` model via the Vercel AI SDK
// (`generateObject`) and return:
//   - `figureData`: structured, partially-filled bilingual fields suitable
//     for inserting a draft row into `figures`.
//   - `citations`: per-field provenance excerpts (which source URL backs
//     each filled field) for inserting into `citations`.
//
// Anti-hallucination contract (see docs/IDEAS.md §4 + §4b):
// - The system prompt forbids using "internal knowledge" — only facts
//   present in the supplied sources may be returned.
// - Unknown fields MUST be left null. Guessing is not allowed.
// - Every filled field MUST cite the URL it came from.

import { generateObject } from 'ai'
import { z } from 'zod'
import { getActiveModel, getModelInstance } from '@athar/ai'

// ── Zod schema for the extraction output ──────────────────────────────
// Mirrors the columns on `figures` (DATABASE.md §4) but only the subset that
// a crawler can plausibly populate. Reviewer fills the rest by hand.
const socialCategoryValues = [
  'anshar',
  'muhajirin',
  'qurasy',
  'arab_non_qurasy',
  'mawla',
  'non_arab',
  'other',
] as const

const genderValues = ['male', 'female'] as const

const FigureExtractionSchema = z.object({
  nameFullAr: z.string().nullable(),
  nameFullId: z.string().nullable(),
  kunyahAr: z.string().nullable(),
  kunyahId: z.string().nullable(),
  birthDateAh: z.number().int().nullable(),
  deathDateAh: z.number().int().nullable(),
  gender: z.enum(genderValues).nullable(),
  socialCategory: z.array(z.enum(socialCategoryValues)).nullable(),
  specialty: z.array(z.string()).nullable(),
  summaryAr: z.string().nullable(),
  summaryId: z.string().nullable(),
  biographyAr: z.string().nullable(),
  biographyId: z.string().nullable(),
  /**
   * Ancestral lineage ("nasab") — ordered child → parent → grandparent → …
   * Each entry is one generation up. Only emit when the source explicitly
   * states the chain (e.g. Sirah Ibn Hisham, biographical encyclopaedias);
   * leave empty otherwise. Per the anti-hallucination contract, never
   * guess names. The worker inserts these as `figure_relations` rows after
   * creating the figure row.
   */
  nasabChain: z
    .array(
      z.object({
        nameId: z.string(),
        nameAr: z.string().nullable(),
        kunyahId: z.string().nullable(),
        kunyahAr: z.string().nullable(),
        laqabId: z.string().nullable(),
      }),
    )
    .default([]),
  /**
   * Per-field citations. Each entry says "for `fieldPath`, the fact came
   * from `sourceUrl` and the original snippet was `excerpt`". The
   * orchestrator turns these into rows in `citations`.
   */
  citations: z
    .array(
      z.object({
        fieldPath: z.string(),
        sourceUrl: z.string().url(),
        excerptAr: z.string().nullable(),
        excerptId: z.string().nullable(),
      }),
    )
    .default([]),
})

export type FigureExtractionResult = z.infer<typeof FigureExtractionSchema>

/** A single source page fed into the extractor. */
export interface ExtractionSource {
  url: string
  /** Raw HTML or already-stripped text. We trim to ~8k chars to fit context. */
  content: string
}

export interface ExtractFigureDataResult {
  figureData: Omit<FigureExtractionResult, 'citations' | 'nasabChain'>
  citations: FigureExtractionResult['citations']
  /** Optional ancestral lineage extracted from sources. */
  nasabChain: FigureExtractionResult['nasabChain']
  /** ModelId used (e.g. `deepseek-chat`), so callers can persist `model_used`. */
  modelUsed: string
}

const SYSTEM_PROMPT = [
  'You are a careful historical-biography extractor for Islamic salaf scholarship.',
  '',
  'RULES (NON-NEGOTIABLE):',
  '1. You may use ONLY information that is literally present in the SOURCES the user provides.',
  '   Do NOT use your own background knowledge. If a fact is not in the sources, return null.',
  '2. For every field you fill, you MUST add an entry to the `citations` array pointing to the',
  '   source URL it came from, plus a short Arabic excerpt (and Indonesian translation if obvious).',
  '3. Dates use the Hijri (AH) calendar — convert if the source explicitly gives a Hijri year.',
  '   If only Gregorian (CE) is given, leave the AH field null.',
  '4. Names: keep `*Ar` fields in original Arabic script. `*Id` fields are standard Indonesian',
  '   transliteration (e.g. "أبو بكر الصديق" → "Abu Bakr ash-Shiddiq"). Do not paraphrase.',
  '5. `biographyAr` / `biographyId`: keep concise (2-4 paragraphs), grounded in sources.',
  '6. If sources conflict, prefer the higher-priority source; do NOT invent a synthesis.',
  '7. `nasabChain`: when sources EXPLICITLY list the ancestral lineage (Sirah Ibn',
  '   Hisham, biographical dictionaries, etc.), emit one entry per generation',
  '   ordered child → parent → grandparent → …  Each entry is ONE link in the',
  '   chain. Names: `nameId` Indonesian transliteration, `nameAr` original Arabic.',
  '   If the source does not list the chain, leave `nasabChain` as an empty array.',
  '',
  'If the sources are empty, irrelevant, or about a different person, return every field as null',
  'with an empty citations array. Returning null is always preferable to guessing.',
].join('\n')

function buildUserPrompt(name: string, sources: ExtractionSource[]): string {
  const lines: string[] = []
  lines.push(`Target figure: ${name}`)
  lines.push('')
  lines.push('SOURCES (each delimited by ---):')
  for (const s of sources) {
    lines.push('---')
    lines.push(`URL: ${s.url}`)
    lines.push('CONTENT:')
    // Cap each source to keep total prompt under ~32k chars.
    lines.push(s.content.slice(0, 8000))
  }
  lines.push('---')
  lines.push('')
  lines.push('Extract the structured biography per the schema. Cite every filled field.')
  return lines.join('\n')
}

/**
 * Run structured extraction over a small set of source pages.
 *
 * Throws if `getActiveModel('agent')` is misconfigured or the LLM call fails
 * — callers (the QStash job) should let the error bubble so QStash retries.
 */
export async function extractFigureData(
  name: string,
  sources: ExtractionSource[],
): Promise<ExtractFigureDataResult> {
  if (sources.length === 0) {
    return {
      figureData: emptyFigureData(),
      citations: [],
      nasabChain: [],
      modelUsed: 'none',
    }
  }

  const active = await getActiveModel('agent')
  const model = getModelInstance(active)

  const { object } = await generateObject({
    model,
    schema: FigureExtractionSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(name, sources),
    // Lower temperature: we want recall of source facts, not creativity.
    temperature: 0.1,
  })

  const { citations, nasabChain, ...figureData } = object
  return {
    figureData,
    citations,
    nasabChain,
    modelUsed: active.model.modelId,
  }
}

function emptyFigureData(): Omit<FigureExtractionResult, 'citations' | 'nasabChain'> {
  return {
    nameFullAr: null,
    nameFullId: null,
    kunyahAr: null,
    kunyahId: null,
    birthDateAh: null,
    deathDateAh: null,
    gender: null,
    socialCategory: null,
    specialty: null,
    summaryAr: null,
    summaryId: null,
    biographyAr: null,
    biographyId: null,
  }
}
