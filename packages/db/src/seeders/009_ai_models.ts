import { getSeedDb, logSeed } from './_helpers.js'
import { aiProviders, aiModels } from '../schema/index.js'

// Verified May 2026. See REFERENCES.md §A.
type ModelSeed = {
  providerSlug: string
  modelId: string
  displayName: string
  capabilities: string[]
  contextWindow?: number
  maxOutputTokens?: number
  supportsTools?: boolean
  supportsVision?: boolean
  inputPricePer1m?: string
  outputPricePer1m?: string
  releaseDate?: string
  isActive: boolean
  notes?: string
}

const MODELS: ModelSeed[] = [
  // ─── DeepSeek (default for chat & agent) ──────────────────────────
  {
    providerSlug: 'deepseek',
    modelId: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash',
    capabilities: ['chat', 'agent'],
    contextWindow: 1_000_000,
    supportsTools: true,
    isActive: true,
    releaseDate: '2026-04-24',
    notes: '284B MoE / 13B active. 1M context.',
  },
  {
    providerSlug: 'deepseek',
    modelId: 'deepseek-v4-pro',
    displayName: 'DeepSeek V4 Pro',
    capabilities: ['chat', 'agent', 'doc_analyzer'],
    contextWindow: 1_000_000,
    supportsTools: true,
    isActive: false,
    releaseDate: '2026-04-24',
    notes: '1.6T MoE / 49B active. Flagship.',
  },

  // ─── Anthropic ────────────────────────────────────────────────────
  {
    providerSlug: 'anthropic',
    modelId: 'claude-opus-4-7',
    displayName: 'Claude Opus 4.7',
    capabilities: ['chat', 'agent', 'doc_analyzer'],
    contextWindow: 200_000,
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-04-16',
    notes: 'Most capable. Long-form Arab parsing.',
  },
  {
    providerSlug: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    capabilities: ['chat', 'agent', 'doc_analyzer'],
    contextWindow: 200_000,
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-02-01',
    notes: 'Balanced — recommended for doc analyzer.',
  },
  {
    providerSlug: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    capabilities: ['chat'],
    contextWindow: 200_000,
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2025-10-01',
  },

  // ─── OpenAI ───────────────────────────────────────────────────────
  {
    providerSlug: 'openai',
    modelId: 'gpt-5.5-instant',
    displayName: 'GPT-5.5 Instant',
    capabilities: ['chat'],
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-05-05',
    notes: 'New default ChatGPT — -52.5% hallucination.',
  },
  {
    providerSlug: 'openai',
    modelId: 'gpt-5',
    displayName: 'GPT-5',
    capabilities: ['chat', 'agent'],
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2025-08-01',
  },
  {
    providerSlug: 'openai',
    modelId: 'text-embedding-3-large',
    displayName: 'Text Embedding 3 Large',
    capabilities: ['embedding'],
    isActive: false,
    notes: 'Default embedding model (1536 dimensions).',
  },

  // ─── Google Gemini ────────────────────────────────────────────────
  {
    providerSlug: 'google',
    modelId: 'gemini-3.1-pro',
    displayName: 'Gemini 3.1 Pro',
    capabilities: ['chat', 'agent', 'doc_analyzer'],
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-02-19',
    notes: 'Flagship — strong agentic coding.',
  },
  {
    providerSlug: 'google',
    modelId: 'gemini-3.1-flash',
    displayName: 'Gemini 3.1 Flash',
    capabilities: ['chat'],
    supportsTools: true,
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-01-01',
  },
  {
    providerSlug: 'google',
    modelId: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash Lite',
    capabilities: ['chat'],
    isActive: false,
    releaseDate: '2026-03-03',
    notes: 'Cost-efficient.',
  },

  // ─── xAI Grok ─────────────────────────────────────────────────────
  {
    providerSlug: 'xai',
    modelId: 'grok-4.3-beta',
    displayName: 'Grok 4.3 Beta',
    capabilities: ['chat', 'agent'],
    contextWindow: 2_000_000,
    isActive: false,
    releaseDate: '2026-04-17',
    notes: 'Beta — full rollout mid-May 2026.',
  },
  {
    providerSlug: 'xai',
    modelId: 'grok-4.20',
    displayName: 'Grok 4.20',
    capabilities: ['chat', 'agent'],
    contextWindow: 2_000_000,
    isActive: false,
    notes: '16-agent Heavy system.',
  },

  // ─── Mistral ──────────────────────────────────────────────────────
  {
    providerSlug: 'mistral',
    modelId: 'mistral-large-3',
    displayName: 'Mistral Large 3',
    capabilities: ['chat', 'agent'],
    isActive: false,
    releaseDate: '2025-12-01',
    notes: 'Apache 2.0, 675B/41B active.',
  },
  {
    providerSlug: 'mistral',
    modelId: 'mistral-small-4',
    displayName: 'Mistral Small 4',
    capabilities: ['chat', 'doc_analyzer'],
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-03-16',
    notes: 'Unifies Magistral + Pixtral + Devstral.',
  },

  // ─── Alibaba Qwen ─────────────────────────────────────────────────
  {
    providerSlug: 'qwen',
    modelId: 'qwen3.5-omni',
    displayName: 'Qwen3.5 Omni',
    capabilities: ['chat', 'doc_analyzer'],
    supportsVision: true,
    isActive: false,
    releaseDate: '2026-04-01',
    notes: '201 langs incl Arabic native. Multimodal.',
  },
  {
    providerSlug: 'qwen',
    modelId: 'qwen3.6-plus',
    displayName: 'Qwen3.6 Plus',
    capabilities: ['chat', 'agent'],
    isActive: false,
    releaseDate: '2026-04-01',
  },
  {
    providerSlug: 'qwen',
    modelId: 'qwen3.6-27b',
    displayName: 'Qwen3.6 27B (open-weight)',
    capabilities: ['chat', 'agent'],
    isActive: false,
    releaseDate: '2026-04-22',
    notes: 'Dense open-weight, top in 27B class.',
  },

  // ─── Meta Llama ───────────────────────────────────────────────────
  {
    providerSlug: 'meta-llama',
    modelId: 'llama-4-scout',
    displayName: 'Llama 4 Scout',
    capabilities: ['chat'],
    contextWindow: 10_000_000,
    isActive: false,
    releaseDate: '2025-04-05',
    notes: '17B active / 16 experts. 10M context.',
  },
  {
    providerSlug: 'meta-llama',
    modelId: 'llama-4-maverick',
    displayName: 'Llama 4 Maverick',
    capabilities: ['chat', 'doc_analyzer'],
    supportsVision: true,
    isActive: false,
    releaseDate: '2025-04-05',
    notes: '17B active / 128 experts. Multimodal.',
  },
]

export async function seed009AiModels() {
  const db = getSeedDb()
  const providers = await db.select().from(aiProviders)
  const providerBySlug = new Map(providers.map((p) => [p.slug, p.id]))

  const data = MODELS.map((m) => {
    const providerId = providerBySlug.get(m.providerSlug)
    if (!providerId) throw new Error(`Provider not found: ${m.providerSlug}`)
    return {
      providerId,
      modelId: m.modelId,
      displayName: m.displayName,
      capabilities: m.capabilities,
      contextWindow: m.contextWindow,
      maxOutputTokens: m.maxOutputTokens,
      supportsStreaming: true,
      supportsTools: m.supportsTools ?? false,
      supportsVision: m.supportsVision ?? false,
      inputPricePer1m: m.inputPricePer1m,
      outputPricePer1m: m.outputPricePer1m,
      releaseDate: m.releaseDate,
      isActive: m.isActive,
      notes: m.notes,
    }
  })

  const result = await db.insert(aiModels).values(data).onConflictDoNothing().returning()
  logSeed('ai_models', result.length)
}
