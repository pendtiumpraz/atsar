import { getSeedDb, logSeed } from './_helpers.js'
import { aiProviders } from '../schema/index.js'
import { encryptApiKey } from '../crypto.js'

const PROVIDERS: Array<{
  slug: string
  name: string
  sdkAdapter:
    | 'openai-compatible'
    | 'anthropic'
    | 'google'
    | 'deepseek'
    | 'custom'
  baseUrl?: string
  apiKeyEnv?: string
  isActive: boolean
  notes?: string
}> = [
  {
    slug: 'deepseek',
    name: 'DeepSeek',
    sdkAdapter: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKeyEnv: 'SEED_DEEPSEEK_API_KEY',
    isActive: true,
    notes: 'V4 Pro/Flash (Apr 2026). Default for chat & agent.',
  },
  {
    slug: 'anthropic',
    name: 'Anthropic',
    sdkAdapter: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    isActive: false,
    notes: 'Claude Opus 4.7 / Sonnet 4.6 / Haiku 4.5. Enable via admin panel.',
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    sdkAdapter: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    isActive: false,
    notes: 'GPT-5.5 Instant (May 2026). Enable via admin panel.',
  },
  {
    slug: 'google',
    name: 'Google Gemini',
    sdkAdapter: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    isActive: false,
    notes: 'Gemini 3.1 Pro/Flash (Feb 2026). Enable via admin panel.',
  },
  {
    slug: 'xai',
    name: 'xAI',
    sdkAdapter: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    isActive: false,
    notes: 'Grok 4.3 Beta (Apr 2026). Enable via admin panel.',
  },
  {
    slug: 'mistral',
    name: 'Mistral AI',
    sdkAdapter: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    isActive: false,
    notes: 'Large 3 / Small 4 (Mar 2026). Apache 2.0.',
  },
  {
    slug: 'qwen',
    name: 'Alibaba Qwen',
    sdkAdapter: 'openai-compatible',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    isActive: false,
    notes: 'Qwen3.5/3.6 — strong Arabic (201 langs).',
  },
  {
    slug: 'meta-llama',
    name: 'Meta Llama (via Groq/Together)',
    sdkAdapter: 'openai-compatible',
    isActive: false,
    notes: 'Llama 4 Scout/Maverick — 10M context. Provided via Groq, Together, etc.',
  },
]

export async function seed008AiProviders() {
  const db = getSeedDb()
  const data = PROVIDERS.map((p) => {
    const rawKey = p.apiKeyEnv ? process.env[p.apiKeyEnv] : undefined
    return {
      slug: p.slug,
      name: p.name,
      sdkAdapter: p.sdkAdapter,
      baseUrl: p.baseUrl,
      apiKeyEncrypted: rawKey ? encryptApiKey(rawKey) : null,
      isActive: p.isActive,
      notes: p.notes,
    }
  })
  const result = await db.insert(aiProviders).values(data).onConflictDoNothing().returning()
  logSeed('ai_providers', result.length)
}
