// LLM-driven figure extraction.
//
// Given a chunk of plain text (typically a transcribed PDF or an admin-pasted
// snippet), ask the configured `doc_analyzer` model to enumerate every
// distinct named figure plus the structured fields we care about for the
// `figures` table. Output is constrained by zod via `generateObject` so a
// hallucinated free-form response can't slip into the merge step.
//
// IDEAS.md §5 ("lengkapi, jangan timpa") + §4b (bilingual): the extractor's
// job is to surface candidate data; merging + conflict detection happens in
// `./merge.ts`.

import { generateObject } from 'ai'
import { z } from 'zod'

import { getActiveModel, getModelInstance, logUsage } from '@athar/ai'

/** Loose date — admins/AI shouldn't pretend false precision. */
export const ExtractedDateSchema = z.object({
  year_ah: z.number().int().nullable().optional(),
  year_ce: z.number().int().nullable().optional(),
  precision: z.enum(['year', 'month', 'day', 'approximate']).nullable().optional(),
  notes: z.string().nullable().optional(),
})
export type ExtractedDate = z.infer<typeof ExtractedDateSchema>

/** A source excerpt the model claims supports the extracted facts. */
export const SourceExcerptSchema = z.object({
  text: z.string(),
  /** Optional URL/page reference if available in the document. */
  reference: z.string().nullable().optional(),
  lang: z.enum(['ar', 'id', 'en']).nullable().optional(),
})
export type SourceExcerpt = z.infer<typeof SourceExcerptSchema>

/** Per-figure structured payload — mirrors `figures` columns we can fill. */
export const ExtractedFigureSchema = z.object({
  name_full_ar: z.string().min(1).describe('Full Arabic name including nasab'),
  name_full_id: z.string().min(1).describe('Indonesian transliteration of full name'),
  kunyah_ar: z.string().nullable().optional(),
  kunyah_id: z.string().nullable().optional(),
  laqab_ar: z.string().nullable().optional(),
  laqab_id: z.string().nullable().optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
  birth: ExtractedDateSchema.nullable().optional(),
  death: ExtractedDateSchema.nullable().optional(),
  summary_ar: z.string().nullable().optional(),
  summary_id: z.string().nullable().optional(),
  source_excerpts: z.array(SourceExcerptSchema).default([]),
  /** Model's own confidence (0–1). Not authoritative; reviewer is. */
  confidence: z.number().min(0).max(1).nullable().optional(),
})
export type ExtractedFigure = z.infer<typeof ExtractedFigureSchema>

const ExtractionResultSchema = z.object({
  figures: z.array(ExtractedFigureSchema).default([]),
})

const SYSTEM_PROMPT = `You are a meticulous Islamic studies research assistant.
Read the provided document text and extract EVERY distinct named figure
(sahabat, tabi'in, tabi'ut tabi'in, ulama, shalih/shalihah, nabi).

Rules:
- ONE entry per distinct person — do not duplicate by kunyah/laqab.
- Use the full Arabic name as printed in the source for "name_full_ar".
- Transliterate to standard Indonesian (e.g. "Umar bin al-Khattab") for "name_full_id".
- If a field is not stated in the source, leave it NULL — never guess.
- For each figure include at least one "source_excerpts" entry quoting the
  exact passage from the input that supports the data.
- If the document mentions no named figures, return an empty list.
- Do not summarise content the source does not contain.`

export interface AnalyzeMeta {
  /** Indicates fallback to the chat model because no doc_analyzer is active. */
  fellBackToChat: boolean
  modelId: string
  providerSlug: string
  durationMs: number
}

export interface AnalyzeResult {
  figures: ExtractedFigure[]
  meta: AnalyzeMeta
}

/**
 * Run the LLM extractor over plain text. Falls back to the `chat` role if the
 * admin hasn't activated a `doc_analyzer` model — the fallback is flagged in
 * `meta.fellBackToChat` so the calling job can audit the degraded path.
 *
 * @param text       Document body. Trim large PDFs to ~30k chars upstream.
 * @param requestedBy Optional userId for usage logging.
 */
export async function analyzeDocText(
  text: string,
  requestedBy?: string | null,
): Promise<AnalyzeResult> {
  if (!text || text.trim().length === 0) {
    return {
      figures: [],
      meta: {
        fellBackToChat: false,
        modelId: 'none',
        providerSlug: 'none',
        durationMs: 0,
      },
    }
  }

  let fellBackToChat = false
  let active
  try {
    active = await getActiveModel('doc_analyzer')
  } catch (err) {
    // No doc_analyzer configured — fall back to the chat model. We surface
    // this via the warning channel + meta so admins know to wire up a
    // dedicated analyzer (typically Claude Sonnet) for production use.
    console.warn(
      '[doc-analyzer] no doc_analyzer model active, falling back to chat',
      err instanceof Error ? err.message : err,
    )
    active = await getActiveModel('chat')
    fellBackToChat = true
  }

  const model = getModelInstance(active)
  const startedAt = Date.now()

  const result = await generateObject({
    model,
    schema: ExtractionResultSchema,
    system: SYSTEM_PROMPT,
    prompt: `Document text:\n\n${text}`,
    // A single PDF can yield 20-50 distinct figures × bilingual fields.
    // SDK default (~4k) truncates mid-array; 16k matches the figure
    // extractor's budget so multi-page books finish in one call.
    maxTokens: 16_000,
    mode: 'json',
    maxRetries: 2,
  })

  const durationMs = Date.now() - startedAt

  // Best-effort usage logging — doc analyzer is a long-running, low-volume
  // pathway so the credit accounting matters less than for chat, but we
  // still record it for cost visibility.
  await logUsage({
    userId: requestedBy ?? null,
    role: fellBackToChat ? 'chat' : 'doc_analyzer',
    providerId: active.provider.id,
    modelId: active.model.id,
    requestType: 'completion',
    inputTokens: result.usage?.promptTokens ?? 0,
    outputTokens: result.usage?.completionTokens ?? 0,
    pricing: {
      inputPricePer1m: active.model.inputPricePer1m,
      outputPricePer1m: active.model.outputPricePer1m,
    },
    durationMs,
    contextSummary: text.slice(0, 280),
    status: 'success',
  })

  return {
    figures: result.object.figures,
    meta: {
      fellBackToChat,
      modelId: active.model.modelId,
      providerSlug: active.provider.slug,
      durationMs,
    },
  }
}
