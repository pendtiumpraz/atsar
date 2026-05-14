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

const TITLE_SYSTEM_PROMPT = `Kamu adalah editor naskah buku Sirah berbahasa Indonesia. Tugasmu
membuat judul buku yang ELEGAN dan PANTAS dipajang di toko buku Islam:
- Hindari kata seperti "Kumpulan", "Daftar", "List", atau judul yang
  terdengar seperti laporan internal.
- Gunakan diksi yang menggugah: "Jejak", "Cahaya", "Lentera",
  "Mutiara", "Tinta", "Telaga", "Bintang", "Lentera Salaf", dsb —
  tapi jangan pakai kata yang sama di setiap judul, variasikan.
- Pakai gelar yang benar: Nabi ﷺ, RA untuk Sahabat, rahimahullah
  untuk Tabi'in & Ulama Salaf. Untuk shahabiyat pakai 'Radhiyallahu
  'anhā'.
- Judul Arab harus terbaca natural oleh penutur Arab. Jangan
  transliterasi judul Indonesia ke huruf Arab.
- Subtitle opsional — hanya kalau menambah info nyata.
- JANGAN cantumkan nama penerbit, harga, atau tahun.`

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

  const userPrompt = `Tokoh dalam buku (${rows.length}):
${figuresBlock}
${parsed.data.styleHint ? `\nGaya yang diinginkan: ${parsed.data.styleHint}` : ''}

Hasilkan satu judul yang menonjolkan ${rows.length === 1 ? 'sosok tunggal ini' : 'tema yang menyatukan tokoh-tokoh ini'}. Jangan generik.`

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
    temperature: 0.7,
    maxTokens: 400,
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
