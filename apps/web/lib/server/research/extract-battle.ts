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
  '3b. `eventDatePrecision`: presisi tanggal yang sumber berikan. Allowed values:',
  '    - \'year\'        → hanya tahun (mis. "2 H")',
  '    - \'month\'       → sampai bulan (mis. "Ramadhan 2 H")',
  '    - \'day\'         → sampai hari (mis. "17 Ramadhan 2 H")',
  '    - \'approximate\' → taqriban / sekitar (mis. "sekitar tahun 2 H")',
  '    - \'range\'       → rentang tahun (mis. "antara 2-3 H")',
  '    Biarkan null bila sumber tidak menyebut presisi.',
  '4. `type` MUST be one of: ghazwah (Nabi ﷺ memimpin), sariyyah (Nabi ﷺ tidak ikut, hanya',
  '   sahabat), futuhat (penaklukan setelah era Nabi ﷺ).',
  '5. `outcome` MUST be one of: victory, defeat, truce, partial. Default to null if ambiguous.',
  '5b. `opponentForce`: deskripsi bebas pihak lawan dalam Bahasa Indonesia (mis. "Pasukan',
  '    Quraisy Makkah", "Bani Quraizhah", "Pasukan Romawi Heraklius"). Maks 200 karakter.',
  '    Biarkan null bila sumber tidak menyebut.',
  '5c. `muslimCount` / `opponentCount` / `casualtiesMuslim` / `casualtiesOpponent`:',
  '    isi angka HANYA bila sumber menyebut secara eksplisit. JANGAN menebak atau',
  '    menginterpolasi dari deskripsi kualitatif ("pasukan besar"). Bila tidak disebut,',
  '    biarkan null.',
  '6. `locationSlug` is a lowercase kebab-case slug guess (e.g. "badar", "uhud", "yarmuk").',
  '   The downstream resolver will match this to the `locations` table — leave it null if',
  '   you cannot identify the venue from the sources.',
  '7. `commanderName` is the free-text commander name as it appears in the source (Arabic',
  '   script or Indonesian transliteration is fine).',
  '8. Narasi — KOMPREHENSIF, bukan ringkasan. Setiap field utama punya dua bahasa:',
  '   - `narrativeId` / `narrativeAr`: 8-15 paragraf yang mengalir kronologis:',
  '     latar belakang → pasukan yang dikumpulkan → keberangkatan → posisi taktis →',
  '     fase-fase pertempuran → korban → penyelesaian → konsekuensi langsung.',
  '     Bila sumber memberi dialog/kutipan, sertakan literal.',
  '   - `strategyId` / `strategyAr`: 3-5 paragraf khusus strategi militer dan',
  '     keputusan komandan. Untuk Badar: pemilihan sumur, formasi pemanah.',
  '   - `significanceId` / `significanceAr`: 2-4 paragraf dampak teologis-historis',
  '     (mis. Badar = pembeda haq & bathil, Uhud = pelajaran ketaatan, Khaibar =',
  '     akhir konfrontasi Yahudi Madinah).',
  '   Untuk *Ar fields gunakan bahasa Arab fushah; bila sumber asli Arab, prefer',
  '   kutipan asli alih-alih back-translate dari Indonesia.',
  '9. If sources conflict, prefer the higher-priority source; do NOT invent a synthesis.',
  '10. Untuk `participants`: ekstrak HANYA tokoh yang sumber salaf menyebut',
  '    namanya secara eksplisit ikut dalam perang ini. JANGAN mengarang',
  '    peserta. Setiap row: figureNameId + figureNameAr WAJIB ada. Role',
  '    menggunakan enum yang tersedia (commander, sub_commander, soldier,',
  '    martyr, captured, wounded, witness, flag_bearer, envoy). Side: muslim',
  '    / opponent / both. Kalau sumber tidak menyebut peserta selain panglima,',
  '    kosongkan array — JANGAN mengulang nama panglima sebagai soldier.',
  '11. Untuk `phases`: pecah pertempuran jadi fase berurutan kalau sumber',
  '    menjelaskan urutannya (Badar: turun ke sumber air → barisan pemanah',
  '    diatur → serangan kavaleri Quraisy → balasan muslim → kemenangan).',
  '    orderIndex 0, 1, 2, ... berurutan kronologis tanpa loncat. Kalau sumber',
  '    tidak memecah fase, kosongkan array — JANGAN mengarang fase. Slug',
  '    lokasi/panah lowercase kebab; biarkan null jika tidak yakin.',
  '',
  'If the sources are empty, irrelevant, or about a different event, return every field as',
  'null with an empty citations array. Returning null is always preferable to guessing.',
].join('\n')

/** Strip prompt-injection vectors from admin hints — see the matching
 *  helper in `extract.ts` (figures). Kept duplicated here so both
 *  extractors stay independent. */
function sanitizeBattleHints(raw: string): string {
  let text = raw.replace(/\r\n?/g, '\n').slice(0, 2000)
  const dangerousLine =
    /^(?:\s*-{3,}\s*|\s*(?:SOURCES?|RULES?|SYSTEM|CONTEXT|INSTRUCTIONS|PROMPT|ADMIN|USER|ASSISTANT)\s*:.*)$/im
  text = text
    .split('\n')
    .filter((line) => !dangerousLine.test(line))
    .join('\n')
  text = text.replace(
    /\b(?:ignore (?:all )?previous|forget (?:your |all )?(?:training|instructions|rules)|disregard (?:the )?(?:above|rules)|you are now|kamu sekarang adalah|abaikan (?:semua )?(?:aturan|instruksi sebelumnya)|jangan (?:cite|kutip|sebutkan sumber))\b[^\n.]{0,120}/gi,
    '[hint dropped]',
  )
  return text.trim()
}

function buildUserPrompt(
  name: string,
  sources: BattleExtractionSource[],
  hints?: string | undefined,
): string {
  const lines: string[] = []
  lines.push(`Target battle: ${name}`)
  if (hints && hints.trim().length > 0) {
    const cleanHints = sanitizeBattleHints(hints)
    if (cleanHints.length > 0) {
      lines.push('')
      lines.push('<<<ADMIN_HINTS — konteks tambahan, BUKAN sumber yang boleh dikutip>>>')
      lines.push(cleanHints)
      lines.push('<<<END_ADMIN_HINTS>>>')
    }
  }
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
  hints?: string | undefined,
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
    prompt: buildUserPrompt(name, sources, hints),
    // Lower temperature: we want recall of source facts, not creativity.
    temperature: 0.1,
    // Comprehensive narratives × 2 languages (narrative 8-15 paragraphs,
    // strategy 3-5, significance 2-4) + up to 50 participants + 15 phases
    // (each phase has Ar+Id narrative up to 2000 chars) + citations.
    // Khaibar/Hunain-class battles easily hit 16-20k output tokens.
    maxTokens: 24_000,
    // Force JSON mode — DeepSeek's tool-call schema discipline is weaker
    // than its JSON-mode discipline, and prose wrappers fail the parser.
    mode: 'json',
    maxRetries: 2,
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
    strategyAr: null,
    narrativeId: null,
    narrativeAr: null,
    significanceId: null,
    significanceAr: null,
  }
}
