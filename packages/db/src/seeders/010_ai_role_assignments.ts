import { and, eq } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import { aiProviders, aiModels, aiRoleAssignments } from '../schema/index.js'

const ASSIGNMENTS: Array<{
  role: 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'
  providerSlug: string
  modelId: string
  optional?: boolean
}> = [
  { role: 'chat', providerSlug: 'deepseek', modelId: 'deepseek-v4-flash' },
  { role: 'agent', providerSlug: 'deepseek', modelId: 'deepseek-v4-flash' },
  // doc_analyzer & embedding require admin to enable Anthropic/OpenAI providers first.
  { role: 'doc_analyzer', providerSlug: 'anthropic', modelId: 'claude-sonnet-4-6', optional: true },
  { role: 'embedding', providerSlug: 'openai', modelId: 'text-embedding-3-large', optional: true },
]

export async function seed010AiRoleAssignments() {
  const db = getSeedDb()
  let total = 0
  for (const a of ASSIGNMENTS) {
    const [provider] = await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.slug, a.providerSlug))
      .limit(1)
    if (!provider) {
      if (!a.optional) console.warn(`  ⚠ provider not found: ${a.providerSlug}`)
      continue
    }
    const [model] = await db
      .select()
      .from(aiModels)
      .where(and(eq(aiModels.providerId, provider.id), eq(aiModels.modelId, a.modelId)))
      .limit(1)
    if (!model) {
      if (!a.optional) console.warn(`  ⚠ model not found: ${a.modelId}`)
      continue
    }
    const inserted = await db
      .insert(aiRoleAssignments)
      .values({ role: a.role, modelId: model.id })
      .onConflictDoNothing()
      .returning()
    if (inserted.length > 0) total++
  }
  logSeed('ai_role_assignments', total)
}
