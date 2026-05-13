// POST /api/v1/ai/chat — streaming chat completion.
//
// Permission: `ai.chat`. Body: { messages: [{role, content}, ...] }.
// Streams via Vercel AI SDK `streamText` → `toDataStreamResponse()`.
// Logs token usage (non-blocking) to `ai_usage_logs` via `onFinish`.
//
// See docs/BACKEND.md §6.2.

import { z } from 'zod'
import { streamText, type CoreMessage } from 'ai'

import { ApiError, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import {
  getActiveModel,
  getModelInstance,
  logUsage,
  calculateCredits,
} from '@athar/ai'

// ─── Validation ────────────────────────────────────────────────────────────
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(200),
})

// Run on Node.js (not Edge): we need pg/crypto. AI SDK supports both.
export const runtime = 'nodejs'
// Streaming responses must not be statically optimised / cached.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = withErrorHandling(async (req) => {
  // ─── Auth + permission (returns userId from session) ──────────────────
  const { userId } = await requirePermission(req, 'ai.chat')

  // ─── Quota ─────────────────────────────────────────────────────────────
  // TODO(agent-7): wire to quota service once available:
  //   import { ensureQuota } from '@/lib/server/services/quota.service'
  //   await ensureQuota(userId, 'ai_chat')

  // ─── Parse body ────────────────────────────────────────────────────────
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
  // Narrow the validated payload into AI SDK's CoreMessage union. Our schema
  // only accepts string content, which is a valid subtype of each of the
  // role-specific content types in CoreMessage.
  const messages: CoreMessage[] = parsed.data.messages.map((m) => {
    switch (m.role) {
      case 'system':
        return { role: 'system', content: m.content }
      case 'user':
        return { role: 'user', content: m.content }
      case 'assistant':
        return { role: 'assistant', content: m.content }
    }
  })

  // ─── Resolve active model ──────────────────────────────────────────────
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

  // ─── Stream ────────────────────────────────────────────────────────────
  const result = streamText({
    model,
    messages,
    onFinish: async ({ usage, finishReason }) => {
      const inputTokens = usage?.promptTokens ?? 0
      const outputTokens = usage?.completionTokens ?? 0
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
