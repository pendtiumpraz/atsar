// POST /api/v1/ai/generate-title — generate an Indonesian + Arabic book
// title from a list of figure slugs.
//
// Used by the PDF builder wizard. The previous implementation in
// components/pdf-builder/wizard.tsx#generateTitle() just concatenated the
// first figure's display name — the button felt fake. This route calls
// the `agent` role model (DeepSeek V4 Flash by default) via the Vercel AI
// SDK `generateObject` so the output is a structured JSON object and the
// caller doesn't have to parse free-form text.

import { z } from 'zod'
import { generateObject } from 'ai'
import { inArray, isNull, and } from 'drizzle-orm'

import { ApiError, ok, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import {
  getActiveModel,
  getModelInstance,
  logUsage,
  calculateCredits,
} from '@athar/ai'
import { db } from '@athar/db'
import { figures } from '@athar/db/schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const bodySchema = z.object({
  figureSlugs: z.array(z.string().min(1).max(120)).min(1).max(30),
  /** Optional hint to bias the tone (e.g. "untuk anak-anak"). */
  styleHint: z.string().max(200).optional(),
})

const responseSchema = z.object({
  titleId: z
    .string()
    .min(3)
    .max(120)
    .describe('Judul buku berbahasa Indonesia. Elegan, tidak generik.'),
  titleAr: z
    .string()
    .min(3)
    .max(120)
    .describe('Judul buku berbahasa Arab (tulisan Arab) yang berkesesuaian dengan titleId.'),
  subtitleId: z
    .string()
    .max(200)
    .optional()
    .describe('Anak judul singkat, max 1 kalimat, opsional.'),
})

const TITLE_SYSTEM_PROMPT = `Kamu adalah editor naskah buku Sirah berbahasa Indonesia, dengan
selera bahasa sastra yang halus. Tugasmu membaca ringkasan tokoh-tokoh
yang akan dimuat dalam SATU buku, lalu menyarikan **benang merah** di
antara mereka menjadi sebuah judul yang ELEGAN, PUITIS, dan layak
dipajang di toko buku Islam premium.

PROSES MENYUSUN JUDUL (wajib dilakukan secara internal sebelum
memutuskan):
  1. Baca SETIAP ringkasan tokoh dengan teliti.
  2. Identifikasi tema yang menyatukan: keilmuan, jihad, keteguhan,
     keadilan, dakwah, generasi tertentu, geografi, peran sosial,
     pengabdian khusus, dll.
  3. Pilih kiasan/diksi yang menggambarkan tema tersebut — bukan
     "Kumpulan", "Daftar", "List", atau frasa generik.
  4. Pastikan judul Indonesia dan Arab membawa NUANSA yang sama
     (bukan terjemahan harfiah, tapi resonansi yang setara).

LARANGAN KERAS:
  - JANGAN gunakan format "Kumpulan Sirah — N Tokoh" atau variasinya.
  - JANGAN sekadar menggabungkan nama-nama tokoh.
  - JANGAN pakai kata "buku" atau "kitab" di dalam judul (judul
    BUKAN sub-judul).
  - JANGAN cantumkan nama penerbit, harga, atau tahun.

DIKSI YANG DIANJURKAN (pilih 1, variasikan tiap permintaan, jangan
selalu pakai kata yang sama):
  Cahaya, Bintang, Mutiara, Telaga, Tinta, Lentera, Jejak, Lentera,
  Embun, Pelita, Mata Air, Permata, Suluh, Untaian, Sebaran, Lintasan,
  Pilar, Tilas, Lautan, Mahkota, Wangi, Suara, Sayap.

GELAR (wajib akurat):
  - Nabi ﷺ atau "shallallahu 'alaihi wa sallam".
  - Sahabat → "RA" atau "رضي الله عنه/عنها".
  - Tabi'in / Ulama Salaf → "rahimahullah" atau "رحمه الله".

JUDUL ARAB:
  - Harus natural — pakai diksi Arab sastra (lentera = مصباح/سراج,
    cahaya = نور, mutiara = درّة, jejak = أَثَر, telaga = حوض/كوثر,
    untaian = عقد, suluh = قبس).
  - JANGAN transliterasi judul Indonesia ke huruf Arab.

SUBTITLE: opsional, hanya kalau menambah info nyata (mis. "Tujuh
Fuqaha Madinah"). Maks 1 kalimat singkat.

CONTOH HASIL YANG BAIK:
  - "Lentera Tujuh Fuqaha Madinah" / "مصابيح الفقهاء السبعة بالمدينة"
  - "Mata Air Sunnah: Para Imam Hadits dari Khurasan" /
    "ينابيع السنة: أئمة الحديث من خراسان"
  - "Mahkota Generasi Sahabat" / "تاج جيل الصحابة"`

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requireAuth(req)

  let json: unknown
  try {
    json = await req.json()
  } catch (cause) {
    throw new ApiError('VALIDATION_ERROR', 'Body JSON tidak valid', { cause })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    throw new ApiError('VALIDATION_ERROR', 'Body tidak sesuai skema', {
      details: parsed.error.issues,
    })
  }

  // Load figure metadata so the model has something concrete to title.
  const rows = await db
    .select({
      slug: figures.slug,
      nameFullId: figures.nameFullId,
      nameFullAr: figures.nameFullAr,
      kunyahId: figures.kunyahId,
      laqabId: figures.laqabId,
      summaryId: figures.summaryId,
      gender: figures.gender,
    })
    .from(figures)
    .where(and(inArray(figures.slug, parsed.data.figureSlugs), isNull(figures.deletedAt)))

  if (rows.length === 0) {
    throw new ApiError(
      'NOT_FOUND',
      'Tokoh yang dipilih tidak ditemukan di database.',
    )
  }

  const figuresBlock = rows
    .map((r) => {
      const titleBits = [r.nameFullId ?? r.slug, r.kunyahId, r.laqabId]
        .filter(Boolean)
        .join(' · ')
      return `- ${titleBits}\n  ${r.summaryId ?? '(tanpa ringkasan)'}`
    })
    .join('\n')

  // Salt the prompt with a small per-request hint so a re-roll on the
  // same figures actually produces a different title (otherwise low
  // temperature + identical input → identical output).
  const salts = [
    'condongkan ke nuansa keilmuan',
    'condongkan ke nuansa keteguhan iman',
    'condongkan ke nuansa pengabdian dan jihad',
    'condongkan ke nuansa kelembutan akhlak',
    'condongkan ke nuansa warisan ilmu yang tersambung',
    'condongkan ke nuansa geografi/perjalanan',
    'condongkan ke nuansa zuhud dan ibadah',
  ]
  const salt = salts[Math.floor(Math.random() * salts.length)] ?? salts[0]

  const userPrompt = `Tokoh dalam buku (${rows.length}):
${figuresBlock}
${parsed.data.styleHint ? `\nGaya yang diinginkan user: ${parsed.data.styleHint}` : ''}

ARAHAN UNTUK SESI INI: ${salt}.

LAKUKAN SEKARANG (internal, jangan tampilkan di output):
  1. Sarikan benang merah dari ${rows.length === 1 ? 'sosok ini' : `${rows.length} tokoh ini`} berdasarkan ringkasan di atas.
  2. Pilih satu diksi yang paling cocok untuk tema itu.
  3. Rangkai judul ID + AR + (opsional) subtitle.

Hasilkan output JSON sesuai schema. Jangan menjawab dalam prosa.`

  const active = await getActiveModel('agent').catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Model agent tidak tersedia'
    throw new ApiError('CONFLICT', message)
  })
  const model = getModelInstance(active)
  const startedAt = Date.now()

  const result = await generateObject({
    model,
    system: TITLE_SYSTEM_PROMPT,
    prompt: userPrompt,
    schema: responseSchema,
    // Higher temperature than the chat route — title-making is a creative
    // synthesis task, not a factual recall task. We want different diction
    // every reroll, so the user can keep clicking "Generate dari AI" until
    // they find one they like.
    temperature: 0.9,
    topP: 0.95,
    // Token budget scales with the number of figures: more figures =
    // bigger schema scaffold + more candidate diction. Base 600 covers
    // the JSON wrap + 1 figure; +400 per additional figure. Clamp 600
    // (single fig) to 4000 (full 30-fig batch). Generous enough to
    // never trigger AI_JSONParseError ("Unexpected end of JSON input"
    // when finishReason='length'); tight enough that boncos prompts
    // get caught early.
    maxTokens: Math.min(4000, 600 + rows.length * 400),
    maxRetries: 1,
  })

  // Best-effort usage log; non-blocking.
  try {
    const inputTokens = result.usage?.promptTokens ?? 0
    const outputTokens = result.usage?.completionTokens ?? 0
    const credits = calculateCredits(inputTokens, outputTokens, {
      inputPricePer1m: active.model.inputPricePer1m,
      outputPricePer1m: active.model.outputPricePer1m,
    })
    await logUsage({
      userId,
      role: 'agent',
      providerId: active.provider.id,
      modelId: active.model.id,
      requestType: 'completion',
      inputTokens,
      outputTokens,
      creditsUsed: credits,
      contextSummary: `pdf-title gen (${rows.length} tokoh)`,
      durationMs: Date.now() - startedAt,
      status: 'success',
    })
  } catch {
    /* swallow logging failures */
  }

  return ok(result.object)
})
