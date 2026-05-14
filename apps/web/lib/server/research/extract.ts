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

const madhabValues = [
  'shafii',
  'maliki',
  'hanafi',
  'hanbali',
  'zhahiri',
  'no_madhab',
] as const

// Match `rijal_grade_enum` in packages/db/src/schema/enums.ts exactly —
// any drift here would 422 the worker UPDATE.
const rijalGradeValues = [
  'sahabi_udul',
  'thiqah_thiqah',
  'thiqah_hafidz',
  'thiqah',
  'saduq',
  'la_basa_bih',
  'shalih_al_hadith',
  'layyin',
  'daif',
  'matruk',
  'kadhdhab',
  'not_narrator',
  'unverified',
] as const

const deathCauseValues = ['natural', 'martyr', 'killed', 'unknown'] as const

const figureLocationRoleValues = [
  'birthplace',
  'residence',
  'dakwah',
  'martyr',
  'burial',
] as const

const figureRelationTypeValues = [
  'teacher_of',
  'student_of',
  'father',
  'mother',
  'husband',
  'wife',
  'son',
  'daughter',
  'sibling',
  'companion',
  'descendant',
  'ancestor',
] as const

const FigureExtractionSchema = z.object({
  nameFullAr: z.string().nullable(),
  nameFullId: z.string().nullable(),
  nameShortAr: z.string().nullable(),
  nameShortId: z.string().nullable(),
  kunyahAr: z.string().nullable(),
  kunyahId: z.string().nullable(),
  laqabAr: z.string().nullable(),
  laqabId: z.string().nullable(),
  birthDateAh: z.number().int().nullable(),
  birthDateCe: z.number().int().nullable(),
  deathDateAh: z.number().int().nullable(),
  deathDateCe: z.number().int().nullable(),
  deathCause: z.enum(deathCauseValues).nullable(),
  gender: z.enum(genderValues).nullable(),
  socialCategory: z.array(z.enum(socialCategoryValues)).nullable(),
  specialty: z.array(z.string()).nullable(),
  madhab: z.enum(madhabValues).nullable(),
  rijalGrade: z.enum(rijalGradeValues).nullable(),
  rijalNotesAr: z.string().nullable(),
  rijalNotesId: z.string().nullable(),
  hadithCountMin: z.number().int().nullable(),
  hadithCountMax: z.number().int().nullable(),
  summaryAr: z.string().nullable(),
  summaryId: z.string().nullable(),
  biographyAr: z.string().nullable(),
  biographyId: z.string().nullable(),
  biographyPreWafatAr: z.string().nullable(),
  biographyPreWafatId: z.string().nullable(),
  biographyPostWafatAr: z.string().nullable(),
  biographyPostWafatId: z.string().nullable(),
  /**
   * Lokasi utama yang erat dengan tokoh — diisi dengan NAMA kota/wilayah
   * (mis. "Madinah", "Kufah", "Baghdad"). Worker akan lookup `locations`
   * table untuk resolve ke ID. Bila nama tidak match row mana pun, field
   * dibiarkan null pada figure row (worker log a warning).
   */
  primaryLocationName: z.string().nullable(),
  deathLocationName: z.string().nullable(),
  burialLocationName: z.string().nullable(),
  /**
   * Daftar lokasi yang punya peran spesifik dalam hidup tokoh
   * (kelahiran, kediaman, dakwah, syahid, dimakamkan). Worker akan
   * insert ke `figure_locations` setelah resolve nama → location_id.
   * Periode opsional — bila sumber menyebut "tinggal di Bashrah dari
   * 80H sampai 110H", isi periodStartAh=80 dan periodEndAh=110.
   */
  figureLocations: z
    .array(
      z.object({
        nameId: z.string(),
        nameAr: z.string().nullable(),
        role: z.enum(figureLocationRoleValues),
        periodStartAh: z.number().int().nullable(),
        periodEndAh: z.number().int().nullable(),
        notesId: z.string().nullable(),
      }),
    )
    .default([]),
  /**
   * Hubungan non-nasab tokoh (guru, murid, sahabat, suami/istri, dll).
   * Worker akan lookup figure target by name; bila tidak ditemukan,
   * relasi di-skip dengan log (admin bisa tambah manual nanti). Untuk
   * nasab linear (ayah → kakek → buyut) gunakan `nasabChain` — itu
   * yang sudah ada upsert-on-missing-ancestor logic.
   */
  relations: z
    .array(
      z.object({
        nameId: z.string(),
        nameAr: z.string().nullable(),
        relationType: z.enum(figureRelationTypeValues),
        notesId: z.string().nullable(),
      }),
    )
    .default([]),
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
  '1b. `gender`: \'male\' atau \'female\' bila sumber jelas (nama, kata ganti, konteks).',
  '    Bila ambigu (mis. nama unisex tanpa kunyah, tidak ada kata ganti spesifik)',
  '    biarkan null — JANGAN menebak.',
  '1c. `socialCategory`: array multi-pilih dari kelompok sosial yang relevan dengan tokoh.',
  '    Allowed values:',
  '    - \'anshar\'         → warga asli Madinah (Aus & Khazraj) yang menerima Nabi ﷺ',
  '    - \'muhajirin\'      → sahabat yang hijrah dari Makkah ke Madinah',
  '    - \'qurasy\'         → keturunan suku Quraisy (termasuk Bani Hasyim, Umayyah, dll)',
  '    - \'arab_non_qurasy\' → Arab di luar Quraisy (Tamim, Azd, Hawazin, dll)',
  '    - \'mawla\'          → budak yang dimerdekakan / klien suku (mis. Salim mawla Abi Hudzaifah)',
  '    - \'non_arab\'       → non-Arab seperti Persia, Romawi, Habasyah (mis. Salman al-Farisi)',
  '    - \'other\'          → tidak masuk kategori di atas',
  '    Boleh banyak (mis. seorang muhajir dari Quraisy → [\'muhajirin\', \'qurasy\']). Bila sumber tidak menyebut, biarkan null.',
  '1d. `specialty`: array string spesialisasi keilmuan tokoh. Gunakan kategori SATU KATA',
  '    dari {hadits, fiqh, tafsir, aqidah, lughah, tarikh, lain-lain} — lowercase canonical.',
  '    Mis. ulama hadits + fiqh → ["hadits", "fiqh"]. Bila sumber tidak menyebut atau',
  '    tokoh bukan ulama, biarkan null.',
  '2. For every field you fill, you MUST add an entry to the `citations` array pointing to the',
  '   source URL it came from, plus a short Arabic excerpt (and Indonesian translation if obvious).',
  '3. Dates: emit BOTH `birthDateAh`/`deathDateAh` (Hijri year) AND `birthDateCe`/`deathDateCe`',
  '   (Gregorian year) when the source gives them. If only one calendar is mentioned, leave',
  '   the other null — do NOT convert across calendars yourself.',
  '3b. `laqabAr`/`laqabId`: the famous title/epithet (e.g. "ash-Shiddiq" for Abu Bakr,',
  '    "al-Faruq" for Umar). Only when the source explicitly states the laqab.',
  '3c. `madhab`: ulama-only. Allowed values: shafii, maliki, hanafi, hanbali, zhahiri, no_madhab.',
  '    For Sahabat / Tabi\'in / Tabi\'ut Tabi\'in leave null (madzhab fikih belum kristal di era mereka).',
  '3d. `rijalGrade`: hadith-narrator quality if the source states it. Allowed:',
  '    sahabi_udul (Sahabat — udul secara default), thiqah_thiqah, thiqah_hafidz,',
  '    thiqah, saduq, la_basa_bih, shalih_al_hadith, layyin, daif, matruk,',
  '    kadhdhab, not_narrator (bukan perawi hadits), unverified (belum diverifikasi).',
  '    Leave null when not stated.',
  '4. Names: keep `*Ar` fields in original Arabic script. `*Id` fields are standard Indonesian',
  '   transliteration (e.g. "أبو بكر الصديق" → "Abu Bakr ash-Shiddiq"). Do not paraphrase.',
  '5. `summaryAr` / `summaryId`: 1-2 kalimat ringkas — siapa tokoh ini dalam satu nafas.',
  '5b. `biographyAr` / `biographyId`: KOMPREHENSIF, bukan ringkasan. Target 6-10 paragraf',
  '    bahasa Indonesia yang ngalir, dengan struktur:',
  '    - Asal-usul, nasab, kelahiran (kapan, di mana, latar keluarga)',
  '    - Masa muda, awal masuk Islam / awal menuntut ilmu',
  '    - Guru-guru utama, perjalanan rihlah ilmiah',
  '    - Kontribusi utama (riwayat hadits, kitab yang ditulis, fatwa, pertempuran, dll)',
  '    - Murid-murid yang masyhur',
  '    - Pendapat ulama tentangnya (jarh/ta\'dil bila ada)',
  '    - Wafat (kapan, di mana, sebabnya bila disebut)',
  '    - Warisan keilmuan / pengaruh setelah wafat',
  '    Sertakan kutipan literal singkat dari sumber bila menyangkut sanjungan/celaan',
  '    ulama. Tetap berpegang pada SOURCES — jangan menambah detail di luar sumber.',
  '5c. `biographyAr` mengikuti struktur yang sama dalam bahasa Arab fushah. Bila sumber',
  '    asli berbahasa Arab, prefer kutipan asli (jangan re-translate dari ID).',
  '5d. `biographyPreWafatAr` / `biographyPreWafatId`: bagian biografi yang FOKUS pada',
  '    kehidupan, kontribusi, peristiwa-peristiwa SEBELUM wafat. 3-5 paragraf.',
  '    Bila sumber tidak memisahkan dengan jelas, ekstrak peristiwa yang terjadi',
  '    semasa hidup tokoh (rihlah ilmiah, peperangan, fatwa, pengajaran).',
  '5e. `biographyPostWafatAr` / `biographyPostWafatId`: bagian biografi tentang PASCA',
  '    wafat — warisan kitab, murid yang melanjutkan, pengaruh keilmuan, komentar',
  '    ulama setelah generasi tokoh wafat. 2-4 paragraf. Bila sumber tidak menyebut,',
  '    biarkan null.',
  '5f. `nameShortAr` / `nameShortId`: nama pendek populer yang lazim disebut (mis.',
  '    "Bukhari" untuk Imam al-Bukhari, "Umar" untuk Umar bin al-Khattab). Tanpa kunyah.',
  '5g. `rijalNotesAr` / `rijalNotesId`: kutipan singkat ulama tentang kredibilitas',
  '    tokoh dalam periwayatan hadits (jarh wa ta\'dil). Mis. "قال أحمد: ثقة ثبت".',
  '    Hanya bila sumber menyebut secara eksplisit.',
  '5h. `hadithCountMin` / `hadithCountMax`: rentang jumlah hadits yang diriwayatkan.',
  '    Bila sumber menyebut angka pasti, set min = max. Bila menyebut "lebih dari N",',
  '    set min = N. Bila tidak ada angka, biarkan null.',
  '5i. `deathCause`: sebab wafat bila disebut. Allowed: natural (wafat alami /',
  '    sakit / usia tua), martyr (syahid dalam medan jihad atau dibunuh kafir),',
  '    killed (dibunuh bukan karena syahadah — politik, qadli, dll),',
  '    unknown (tidak jelas).',
  '5j. Lokasi — tiga field tunggal + satu array:',
  '    - `primaryLocationName`: kota/wilayah utama yang lekat dengan tokoh',
  '      (mis. "Madinah" untuk Aisyah, "Kufah" untuk Abu Hanifah, "Bashrah"',
  '      untuk Hasan al-Bashri). Tulis dalam ejaan Indonesia standar.',
  '    - `deathLocationName`: tempat wafat bila disebut.',
  '    - `burialLocationName`: tempat dimakamkan bila berbeda dari tempat wafat.',
  '    - `figureLocations[]`: setiap entry punya `nameId` (Indonesia),',
  '      `nameAr` (Arab, optional), `role` (birthplace | residence | dakwah |',
  '      martyr | burial), dan `periodStartAh` / `periodEndAh` (opsional bila',
  '      sumber menyebut rentang tahun). Boleh entry banyak per role (mis.',
  '      tokoh pindah-pindah residence).',
  '5k. Relasi non-nasab — `relations[]`:',
  '    - Setiap entry punya `nameId` (target tokoh dalam Indonesia), `nameAr`,',
  '      `relationType` (teacher_of | student_of | father | mother | husband |',
  '      wife | son | daughter | sibling | companion | descendant | ancestor),',
  '      dan `notesId` (opsional, 1 kalimat konteks).',
  '    - Untuk nasab linear (ayah → kakek → buyut) gunakan `nasabChain`, bukan',
  '      relations. relations untuk guru, murid, sahabat, pasangan, saudara,',
  '      anak, dst.',
  '    - HANYA emit relasi bila sumber menyebut secara eksplisit. Hindari',
  '      menebak "kemungkinan murid dari X" tanpa basis.',
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

function buildUserPrompt(
  name: string,
  sources: ExtractionSource[],
  hints?: string | undefined,
): string {
  const lines: string[] = []
  lines.push(`Target figure: ${name}`)
  if (hints && hints.trim().length > 0) {
    lines.push('')
    lines.push('ADMIN HINTS (konteks tambahan — bukan sumber yang boleh dikutip):')
    lines.push(hints.trim())
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
  hints?: string | undefined,
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
    prompt: buildUserPrompt(name, sources, hints),
    // Lower temperature: we want recall of source facts, not creativity.
    temperature: 0.1,
    // Biography target is 6-10 paragraphs × 2 languages + pre/post wafat
    // narratives + nasabChain + figureLocations + relations + citations.
    // Long-form ulama biographies (Bukhari, Ibn Hajar) easily hit 12-15k
    // output tokens; 16k gives headroom before generateObject refuses to
    // parse a truncated payload.
    maxTokens: 16_000,
    // Force JSON mode — DeepSeek occasionally wraps tool-call JSON with
    // prose preamble, which trips the parser.
    mode: 'json',
    maxRetries: 2,
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
    nameShortAr: null,
    nameShortId: null,
    kunyahAr: null,
    kunyahId: null,
    laqabAr: null,
    laqabId: null,
    birthDateAh: null,
    birthDateCe: null,
    deathDateAh: null,
    deathDateCe: null,
    deathCause: null,
    gender: null,
    socialCategory: null,
    specialty: null,
    madhab: null,
    rijalGrade: null,
    rijalNotesAr: null,
    rijalNotesId: null,
    hadithCountMin: null,
    hadithCountMax: null,
    summaryAr: null,
    summaryId: null,
    biographyAr: null,
    biographyId: null,
    biographyPreWafatAr: null,
    biographyPreWafatId: null,
    biographyPostWafatAr: null,
    biographyPostWafatId: null,
    primaryLocationName: null,
    deathLocationName: null,
    burialLocationName: null,
    figureLocations: [],
    relations: [],
  }
}
