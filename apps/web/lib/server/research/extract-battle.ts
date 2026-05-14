// LLM structured-extraction for battles (ghazwah / sariyyah / futuhat).
//
// Sibling of `extract.ts` (figures). Given a battle name + a handful of
// source pages, call the registered `agent` model via the Vercel AI SDK
// (`generateObject`) and return:
//   - `battleData`: structured, partially-filled fields suitable for
//     inserting a draft row into `battles` (after location/commander
//     resolution on the worker).
//   - `citations`: per-source provenance (URL + Indonesian excerpt) for
//     inserting into `citations` rows.
//
// Anti-hallucination contract (see docs/IDEAS.md §4 + §4b): the system
// prompt forbids using "internal knowledge" — only facts present in the
// supplied sources may be returned. Unknown fields MUST be left null.

import { generateObject } from 'ai'
import { getActiveModel, getModelInstance } from '@athar/ai'

import {
  battleExtractionSchema,
  type BattleExtractionData,
  type BattleExtractionResult,
} from '@/lib/server/ai/battle-schema'

/** A single source page fed into the extractor. */
export interface BattleExtractionSource {
  url: string
  /** Raw HTML or already-stripped text. We trim to ~8k chars to fit context. */
  content: string
}

export interface ExtractBattleDataResult {
  battleData: BattleExtractionData
  citations: BattleExtractionResult['citations']
  /** ModelId used (e.g. `deepseek-chat`), so callers can persist `model_used`. */
  modelUsed: string
}

const SYSTEM_PROMPT = [
  'You are a careful historical-battle extractor for early Islamic salaf history (ghazwah, sariyyah, futuhat).',
  '',
  'RULES (NON-NEGOTIABLE):',
  '1. You may use ONLY information that is literally present in the SOURCES the user provides.',
  '   Do NOT use your own background knowledge. If a fact is not in the sources, return null.',
  '2. For every filled field that came from a particular source page, add an entry to the',
  '   `citations` array pointing to the source URL plus a short Indonesian-language excerpt.',
  '3. Dates use the Hijri (AH) calendar — convert if the source explicitly gives a Hijri year.',
  '   If only Gregorian (CE) is given, leave the AH field null.',
  '4. `type` MUST be one of: ghazwah (Nabi ﷺ memimpin), sariyyah (Nabi ﷺ tidak ikut, hanya',
  '   sahabat), futuhat (penaklukan setelah era Nabi ﷺ).',
  '5. `outcome` MUST be one of: victory, defeat, truce, partial. Default to null if ambiguous.',
  '6. `locationSlug` is a lowercase kebab-case slug guess (e.g. "badar", "uhud", "yarmuk").',
  '   The downstream resolver will match this to the `locations` table — leave it null if',
  '   you cannot identify the venue from the sources.',
  '7. `commanderName` is the free-text commander name as it appears in the source (Arabic',
  '   script or Indonesian transliteration is fine).',
  '8. `narrativeId` is concise (2-4 paragraphs in Indonesian), grounded in the sources.',
  '9. If sources conflict, prefer the higher-priority source; do NOT invent a synthesis.',
  '',
  'If the sources are empty, irrelevant, or about a different event, return every field as',
  'null with an empty citations array. Returning null is always preferable to guessing.',
].join('\n')

function buildUserPrompt(name: string, sources: BattleExtractionSource[]): string {
  const lines: string[] = []
  lines.push(`Target battle: ${name}`)
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
  lines.push('Extract the structured battle record per the schema. Cite every filled fact.')
  return lines.join('\n')
}

/**
 * Run structured extraction over a small set of source pages.
 *
 * Throws if `getActiveModel('agent')` is misconfigured or the LLM call fails
 * — callers (the QStash worker) should let the error bubble so QStash retries.
 */
export async function extractBattleData(
  name: string,
  sources: BattleExtractionSource[],
): Promise<ExtractBattleDataResult> {
  if (sources.length === 0) {
    return {
      battleData: emptyBattleData(name),
      citations: [],
      modelUsed: 'none',
    }
  }

  const active = await getActiveModel('agent')
  const model = getModelInstance(active)

  const { object } = await generateObject({
    model,
    schema: battleExtractionSchema,
    system: SYSTEM_PROMPT,
    prompt: buildUserPrompt(name, sources),
    // Lower temperature: we want recall of source facts, not creativity.
    temperature: 0.1,
  })

  const { citations, ...battleData } = object
  return {
    battleData,
    citations,
    modelUsed: active.model.modelId,
  }
}

/** Empty placeholder used when zero sources are fetched — keeps the type
 *  exhaustive without inventing facts. The required string fields are filled
 *  from the input name so the schema parses successfully. */
function emptyBattleData(name: string): BattleExtractionData {
  return {
    nameAr: name,
    nameId: name,
    type: 'ghazwah',
    eventDateAh: null,
    eventDateCe: null,
    eventDatePrecision: null,
    eventDateNotes: null,
    locationSlug: null,
    commanderName: null,
    opponentForce: null,
    muslimCount: null,
    opponentCount: null,
    outcome: null,
    casualtiesMuslim: null,
    casualtiesOpponent: null,
    strategyId: null,
    narrativeId: null,
    significanceId: null,
  }
}
