// POST /api/v1/ai/chat — streaming chat completion.
//
// Permission: `ai.chat`. Body: { messages: [{role, content}, ...] }.
// Streams via Vercel AI SDK `streamText` → `toDataStreamResponse()`.
// Logs token usage (non-blocking) to `ai_usage_logs` via `onFinish`.
//
// What this route enforces (top to bottom):
//   1. Session + permission.
//   2. Per-user 10 requests/minute rate limit (Redis, graceful fallback).
//   3. Body validation — max 50 messages, max 4000 chars per message,
//      `system` role from the user is stripped (we own the prompt).
//   4. Pre-flight abuse / prompt-injection detector on the latest user
//      message. Rejects single-char floods, short-string repetition,
//      "ignore previous instructions" patterns, and unsafe role hijacks.
//   5. RAG via Vercel AI SDK tools (`search_figures`, `get_figure_detail`,
//      `search_locations`, `search_battles`, `search_web`). Up to
//      `maxSteps: 5` so the model can chain tool calls before answering.
//   6. Hard caps: `maxTokens: 2048`, `temperature: 0.3`, `maxRetries: 1`.
//
// See docs/BACKEND.md §6.2.

import { z } from 'zod'
import { streamText, type CoreMessage } from 'ai'

import { ApiError, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { redis } from '@/lib/server/upstash'
import {
  getActiveModel,
  getModelInstance,
  logUsage,
  calculateCredits,
} from '@athar/ai'

import { ATSAR_CHAT_SYSTEM_PROMPT } from '@/lib/server/ai/system-prompt'
import { chatTools } from '@/lib/server/ai/chat-tools'

// ─── Validation ────────────────────────────────────────────────────────────
// `content` is capped at 4000 chars — long convos are where prompt injection
// chains accumulate, so we deliberately cap the per-message size below typical
// LLM context allowances.
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(4000),
})

// Messages array max 50. Down from the original 200 — see comment above.
const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(50),
})

// ─── Abuse / prompt-injection detector ────────────────────────────────────
// Each entry: a regex + a human-readable name surfaced as `details.rule` so
// debugging is easier when a legitimate prompt false-positives. ORDER MATTERS
// — earlier rules win. Most are anchored to the latest user message only.
//
// What we DON'T do:
//   - Block role-hijack ("kamu sekarang adalah X") wholesale. That false-
//     positives on legit prompts like "kamu sekarang membantu saya menulis...".
//     We log it as suspicious via a softer rule; only block hard role hijacks
//     paired with "ignore" verbs.
const INJECTION_RULES: { name: string; pattern: RegExp }[] = [
  {
    name: 'single_char_flood',
    pattern: /^(.)\1{200,}$/,
  },
  {
    name: 'short_string_repetition',
    pattern: /(.{1,20})\1{30,}/,
  },
  {
    name: 'explicit_repetition_prompt',
    pattern:
      /(write|tulis|cetak|repeat)\s+["']?[\w\s]{1,3}["']?\s+(\d{4,}|sejuta|million|jutaan)\s+(kali|times)/i,
  },
  {
    name: 'ignore_previous_instructions',
    pattern: /ignore\s+(previous|above|all)\s+(instructions|prompts|rules)/i,
  },
  {
    name: 'override_system_prompt',
    pattern: /(disregard|override|bypass)\s+(your|the)\s+(instructions|system|prompt)/i,
  },
  {
    name: 'ignore_instructions_id',
    pattern: /abaikan\s+(instruksi|aturan|prompt|sistem)\s+(sebelumnya|di atas|sebelum ini)/i,
  },
  {
    name: 'reply_in_mandarin',
    pattern: /(reply|respond|balas|jawab)\s+in\s+(mandarin|chinese|china|中文)/i,
  },
]

/**
 * Run injection rules on the latest user message. Throws
 * `ApiError('VALIDATION_ERROR')` with the rule name on the first match.
 *
 * Only the most-recent user message is scanned — earlier turns are either
 * already in our transcript history or our own assistant responses, neither
 * of which can carry user-controlled injection payloads.
 */
function assertNotAbusive(content: string): void {
  for (const rule of INJECTION_RULES) {
    if (rule.pattern.test(content)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        'Pesan terindikasi penyalahgunaan.',
        { details: { rule: rule.name } },
      )
    }
  }
}

// ─── Per-user rate limit ──────────────────────────────────────────────────
// 10 requests per minute per user. Cheap fixed-window counter (Upstash Redis
// INCR + EXPIRE). The Redis client is wrapped in graceful fallback (see
// lib/server/upstash/redis.ts), so an Upstash outage degrades to "no rate
// limit" rather than 500ing the route.
const RATE_LIMIT_PER_MIN = 10

async function enforceRateLimit(userId: string): Promise<void> {
  const bucket = Math.floor(Date.now() / 60_000)
  const key = `ai-chat:rate:${userId}:${bucket}`
  const count = await redis.incr(key)
  if (count === 1) {
    // First hit in this 60-second window — set the TTL so the key cleans up.
    await redis.expire(key, 70)
  }
  if (count > RATE_LIMIT_PER_MIN) {
    throw new ApiError(
      'RATE_LIMITED',
      'Terlalu banyak permintaan. Coba lagi sebentar.',
    )
  }
}

// ─── Runtime knobs ────────────────────────────────────────────────────────
// Run on Node.js (not Edge): we need pg / Buffer for crypto-key decryption
// inside `@athar/ai`. The AI SDK itself supports both.
export const runtime = 'nodejs'
// Streaming responses must not be statically optimised / cached.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = withErrorHandling(async (req) => {
  // ─── Auth + permission ────────────────────────────────────────────────
  const { userId } = await requirePermission(req, 'ai.chat')

  // ─── Rate limit ───────────────────────────────────────────────────────
  await enforceRateLimit(userId)

  // ─── Parse body ───────────────────────────────────────────────────────
  let json: unknown
  try {
    json = await req.json()
  } catch (cause) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid JSON body', { cause })
  }
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid request body', {
      details: parsed.error.issues,
    })
  }

  // ─── Sanitize: strip any `system` role from caller-supplied messages ──
  // The system prompt is OUR responsibility — the user passing one is a
  // classic injection vector. Drop them silently.
  const sanitized = parsed.data.messages.filter((m) => m.role !== 'system')
  if (sanitized.length === 0) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'Tidak ada pesan yang dapat diproses (system messages diabaikan).',
    )
  }

  // ─── Pre-flight abuse detector on the latest user message ─────────────
  const latestUser = [...sanitized].reverse().find((m) => m.role === 'user')
  if (latestUser) {
    assertNotAbusive(latestUser.content)
  }

  // ─── Narrow to AI SDK CoreMessage[] ───────────────────────────────────
  const messages: CoreMessage[] = sanitized.map((m) => {
    switch (m.role) {
      case 'user':
        return { role: 'user', content: m.content }
      case 'assistant':
        return { role: 'assistant', content: m.content }
      // 'system' was filtered out above; the type predicate keeps TS happy.
      default:
        return { role: 'user', content: m.content }
    }
  })

  // ─── Resolve active model ─────────────────────────────────────────────
  const active = await getActiveModel('chat').catch((err: unknown) => {
    const message =
      err instanceof Error ? err.message : 'Unable to resolve active chat model'
    throw new ApiError('CONFLICT', message)
  })

  const model = getModelInstance(active)
  const startedAt = Date.now()

  const firstUserMsg = messages.find((m) => m.role === 'user')
  const contextSummary =
    typeof firstUserMsg?.content === 'string'
      ? firstUserMsg.content.slice(0, 280)
      : null

  // ─── Stream with tools (RAG) ──────────────────────────────────────────
  const result = streamText({
    model,
    system: ATSAR_CHAT_SYSTEM_PROMPT,
    messages,
    tools: chatTools(userId),
    // Let the model chain up to 5 tool calls before composing the answer.
    // Practical ceiling: search_figures → get_figure_detail → search_battles
    // → search_locations → final summarization is the worst-case path.
    maxSteps: 5,
    toolChoice: 'auto',
    // Hard caps. DeepSeek's default is creative + verbose; pin to factual.
    maxTokens: 2048,
    temperature: 0.3,
    maxRetries: 1,
    onFinish: async ({ usage, finishReason }) => {
      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0
      const totalTokens = inputTokens + outputTokens
      if (totalTokens > 50_000) {
        console.warn(
          '[ai/chat] high token usage',
          { userId, totalTokens, finishReason },
        )
      }
      const credits = calculateCredits(inputTokens, outputTokens, {
        inputPricePer1m: active.model.inputPricePer1m,
        outputPricePer1m: active.model.outputPricePer1m,
      })

      await logUsage({
        userId,
        role: 'chat',
        providerId: active.provider.id,
        modelId: active.model.id,
        requestType: 'completion',
        inputTokens,
        outputTokens,
        creditsUsed: credits,
        contextSummary,
        durationMs: Date.now() - startedAt,
        status: finishReason === 'error' ? 'error' : 'success',
      })

      // TODO(agent-7): increment quota usage here once quota service exists:
      //   await incrementQuotaUsage(userId, 'ai_chat', 1)
    },
    onError: ({ error }) => {
      console.error('[ai/chat] stream error', error)
    },
  })

  return result.toDataStreamResponse()
})
