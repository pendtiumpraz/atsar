// GET  /api/v1/admin/ai-providers — list providers with nested models.
// POST /api/v1/admin/ai-providers — create a new provider (encrypts apiKey).
//
// Permission: `ai_providers.manage`. Response shape is `ProviderDto[]` so the
// API key is never serialized as plaintext — only `apiKeyLast4` is exposed.

import { z } from 'zod'

import { created, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'
import { SDK_ADAPTERS } from '@/lib/server/services/ai-provider.service'

const createSchema = z.object({
  slug: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  sdkAdapter: z.enum(SDK_ADAPTERS),
  baseUrl: z.string().trim().url().max(500).nullable().optional(),
  apiKey: z.string().trim().min(1).max(500).optional().nullable(),
  notes: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'ai_providers.manage')
  const data = await aiSvc.listProviders()
  return ok(data)
})

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'ai_providers.manage')
  const input = await validateBody(req, createSchema)
  const row = await aiSvc.createProvider(input, userId)
  return created(row)
})
