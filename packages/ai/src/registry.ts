// AI provider/model registry — resolves the active model for a role by querying
// `ai_role_assignments → ai_models → ai_providers` and returns a ready-to-use
// Vercel AI SDK LanguageModelV1 instance.
//
// See docs/BACKEND.md §6.1.

import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { aiRoleAssignments, aiModels, aiProviders } from '@athar/db/schema'

import { createDeepSeek } from '@ai-sdk/deepseek'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModelV1 } from 'ai'

import { decryptApiKey } from './crypto.js'

export type AIRole = 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'

export type SdkAdapter = 'deepseek' | 'anthropic' | 'openai-compatible' | 'google' | 'custom'

export interface ActiveModel {
  provider: {
    id: string
    slug: string
    sdkAdapter: SdkAdapter
    baseUrl?: string | undefined
  }
  model: {
    id: string
    modelId: string
    displayName?: string | undefined
    capabilities: string[]
    inputPricePer1m?: string | null
    outputPricePer1m?: string | null
  }
  /** Decrypted API key. */
  apiKey: string
}

/**
 * Minimal local mirror of the API error shape used by the web app, so this
 * package does not pull in Next.js. Routes will catch and re-throw as needed.
 */
export class AIRegistryError extends Error {
  public readonly code: 'CONFLICT' | 'EXTERNAL_AI_ERROR' | 'INTERNAL_ERROR'
  constructor(code: 'CONFLICT' | 'EXTERNAL_AI_ERROR' | 'INTERNAL_ERROR', message: string) {
    super(message)
    this.name = 'AIRegistryError'
    this.code = code
    Object.setPrototypeOf(this, AIRegistryError.prototype)
  }
}

/**
 * Resolve the active provider+model+api key for the given role.
 * Throws `AIRegistryError('CONFLICT', ...)` when no assignment is configured.
 */
export async function getActiveModel(role: AIRole): Promise<ActiveModel> {
  const rows = await db
    .select({
      assignmentId: aiRoleAssignments.id,
      model: aiModels,
      provider: aiProviders,
    })
    .from(aiRoleAssignments)
    .innerJoin(aiModels, eq(aiRoleAssignments.modelId, aiModels.id))
    .innerJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(
      and(
        eq(aiRoleAssignments.role, role),
        isNull(aiRoleAssignments.deletedAt),
        isNull(aiModels.deletedAt),
        isNull(aiProviders.deletedAt),
      ),
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    throw new AIRegistryError('CONFLICT', `No active model for role: ${role}`)
  }
  if (!row.provider.apiKeyEncrypted) {
    throw new AIRegistryError(
      'CONFLICT',
      `Provider ${row.provider.slug} has no API key configured`,
    )
  }

  let apiKey: string
  try {
    apiKey = decryptApiKey(row.provider.apiKeyEncrypted)
  } catch (err) {
    throw new AIRegistryError(
      'INTERNAL_ERROR',
      `Failed to decrypt API key for provider ${row.provider.slug}: ${(err as Error).message}`,
    )
  }

  return {
    provider: {
      id: row.provider.id,
      slug: row.provider.slug,
      sdkAdapter: row.provider.sdkAdapter as SdkAdapter,
      baseUrl: row.provider.baseUrl ?? undefined,
    },
    model: {
      id: row.model.id,
      modelId: row.model.modelId,
      displayName: row.model.displayName ?? undefined,
      capabilities: row.model.capabilities ?? [],
      inputPricePer1m: row.model.inputPricePer1m ?? null,
      outputPricePer1m: row.model.outputPricePer1m ?? null,
    },
    apiKey,
  }
}

/**
 * Convert an `ActiveModel` into a Vercel AI SDK `LanguageModelV1` instance,
 * choosing the appropriate provider factory based on `sdkAdapter`.
 */
export function getModelInstance(active: ActiveModel): LanguageModelV1 {
  const { provider, model, apiKey } = active

  switch (provider.sdkAdapter) {
    case 'deepseek': {
      const dp = createDeepSeek({ apiKey, ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}) })
      return dp.languageModel(model.modelId)
    }
    case 'anthropic': {
      const ap = createAnthropic({ apiKey, ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}) })
      return ap.languageModel(model.modelId)
    }
    case 'openai-compatible': {
      const op = createOpenAI({
        apiKey,
        compatibility: 'compatible',
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      })
      return op.languageModel(model.modelId)
    }
    case 'google': {
      const gp = createGoogleGenerativeAI({
        apiKey,
        ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
      })
      return gp.languageModel(model.modelId)
    }
    case 'custom':
    default:
      throw new AIRegistryError(
        'CONFLICT',
        `Unsupported sdk adapter: ${provider.sdkAdapter}`,
      )
  }
}
