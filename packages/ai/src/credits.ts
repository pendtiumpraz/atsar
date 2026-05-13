// Credit calculation + usage logger.
//
// Pricing convention (see docs/BACKEND.md §6.3):
//   1 credit = $0.001 USD worth of model usage.
//   credits = (inputTokens / 1_000_000) * inputPricePer1m + (outputTokens / 1_000_000) * outputPricePer1m
//   ... multiplied by 1000 to convert USD → credits.

import { db } from '@athar/db'
import { aiUsageLogs } from '@athar/db/schema'

export interface CreditModelPricing {
  inputPricePer1m?: string | number | null
  outputPricePer1m?: string | number | null
}

function toNumber(v: string | number | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Convert raw token counts into credits using the model's per-1M pricing.
 * Result is rounded to 6 decimal places (matches the DB numeric precision).
 */
export function calculateCredits(
  inputTokens: number,
  outputTokens: number,
  model: CreditModelPricing,
): number {
  const inPrice = toNumber(model.inputPricePer1m)
  const outPrice = toNumber(model.outputPricePer1m)
  const inputCostUsd = (Math.max(0, inputTokens) / 1_000_000) * inPrice
  const outputCostUsd = (Math.max(0, outputTokens) / 1_000_000) * outPrice
  const totalUsd = inputCostUsd + outputCostUsd
  // 1 credit = $0.001 → multiply USD by 1000.
  const credits = totalUsd * 1000
  return Math.round(credits * 1_000_000) / 1_000_000
}

export type AIRequestType = 'completion' | 'embedding' | 'image'
export type AIUsageStatus = 'success' | 'error' | 'timeout'

export interface LogUsageArgs {
  userId: string | null
  sessionId?: string | null
  role: 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'
  providerId: string
  modelId: string
  requestType: AIRequestType
  inputTokens: number
  outputTokens: number
  cachedTokens?: number
  /** Optional pricing — used to compute credits. */
  pricing?: CreditModelPricing
  /** Pre-computed credits. Overrides `pricing`-based calculation if provided. */
  creditsUsed?: number
  contextSummary?: string | null
  durationMs?: number
  status?: AIUsageStatus
  errorMessage?: string | null
}

/**
 * Insert one row into `ai_usage_logs`. Non-blocking: on error, logs to
 * console and resolves — never throws. Designed to be called from inside
 * `streamText({ onFinish })` and similar hot paths.
 */
export async function logUsage(args: LogUsageArgs): Promise<void> {
  try {
    const credits =
      args.creditsUsed ??
      (args.pricing
        ? calculateCredits(args.inputTokens, args.outputTokens, args.pricing)
        : 0)

    await db.insert(aiUsageLogs).values({
      userId: args.userId,
      sessionId: args.sessionId ?? null,
      role: args.role,
      providerId: args.providerId,
      modelId: args.modelId,
      requestType: args.requestType,
      contextSummary: args.contextSummary ?? null,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      cachedTokens: args.cachedTokens ?? 0,
      creditsUsed: credits.toFixed(6),
      durationMs: args.durationMs ?? null,
      status: args.status ?? 'success',
      errorMessage: args.errorMessage ?? null,
    })
  } catch (err) {
    console.error('[ai/credits] failed to write ai_usage_logs', err)
  }
}
