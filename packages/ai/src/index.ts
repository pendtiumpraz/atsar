// AI provider abstraction layer.
// Wraps Vercel AI SDK + DB-driven config (ai_providers + ai_models + ai_role_assignments).
// Full implementation lands in Phase 2.6 (BACKEND.md §6).

import type { AIRoleSlug } from '@athar/shared'

export type AIRole = AIRoleSlug

export interface AIModelConfig {
  providerSlug: string
  sdkAdapter: 'openai-compatible' | 'anthropic' | 'google' | 'deepseek' | 'custom'
  modelId: string
  apiKey: string
  baseUrl?: string | undefined
}

// Placeholder; real implementation reads from DB & decrypts api key.
export async function getActiveModel(_role: AIRole): Promise<AIModelConfig> {
  throw new Error('Not yet implemented — wire up in Phase 2.6 with DB lookup.')
}
