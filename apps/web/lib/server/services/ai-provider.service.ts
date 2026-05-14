// AI provider + model + role-assignment service.
//
// See docs/BACKEND.md §6 (AI Provider Abstraction) and IDEAS.md §AI matrix.
//
// Concepts
// ────────
//   - `ai_providers`        — third-party API providers (OpenAI, Anthropic, …).
//     The `api_key_encrypted` column holds AES-256-GCM ciphertext encrypted
//     with `AI_MASTER_KEY`. The plaintext is never returned to the client;
//     responses surface `apiKeyLast4` (the last 4 chars) so admins can
//     confirm which key is in place without exposing the secret.
//   - `ai_models`           — concrete models per provider (chat / vision / …).
//   - `ai_role_assignments` — exactly one active row per role (chat, agent,
//     doc_analyzer, avatar, embedding). Switching a role pins a new
//     model.id; the previous row is hard-deleted (one row per role) and a
//     new one inserted in a single `db.batch([...])`.
//
// All mutations write to `audit_log` via `auditLog.write()`. Decryption only
// happens server-side inside this service and `@athar/ai`'s registry; the
// API key never leaves the server.

import { and, asc, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@athar/db'
import { aiModels, aiProviders, aiRoleAssignments } from '@athar/db/schema'
import { decryptApiKey, encryptApiKey } from '@athar/ai'

import { ApiError } from '@/lib/server/api'
import { auditLog } from './audit.service.js'

// ── Enum mirrors ─────────────────────────────────────────────────────
export const SDK_ADAPTERS = [
  'openai-compatible',
  'anthropic',
  'google',
  'deepseek',
  'custom',
] as const
export type SdkAdapter = (typeof SDK_ADAPTERS)[number]

export const AI_ROLES = ['chat', 'agent', 'doc_analyzer', 'avatar', 'embedding'] as const
export type AIRole = (typeof AI_ROLES)[number]

// ── Row + DTO types ──────────────────────────────────────────────────
export type ProviderRow = typeof aiProviders.$inferSelect
export type ProviderInsert = typeof aiProviders.$inferInsert
export type ModelRow = typeof aiModels.$inferSelect
export type ModelInsert = typeof aiModels.$inferInsert
export type AssignmentRow = typeof aiRoleAssignments.$inferSelect

/** Lightweight model summary attached to provider list responses. */
export interface ProviderModelSummary {
  id: string
  modelId: string
  displayName: string | null
  capabilities: string[] | null
  contextWindow: number | null
  maxOutputTokens: number | null
  inputPricePer1m: string | null
  outputPricePer1m: string | null
  isActive: boolean
}

/**
 * The DTO returned to admin clients. **Never** includes the decrypted key —
 * only the last 4 plaintext characters so admins can confirm which secret
 * is in place.
 */
export interface ProviderDto {
  id: string
  slug: string
  name: string
  sdkAdapter: SdkAdapter
  baseUrl: string | null
  apiKeyLast4: string | null
  isActive: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  models: ProviderModelSummary[]
}

export interface ModelDto {
  id: string
  providerId: string
  providerName: string
  providerSlug: string
  modelId: string
  displayName: string | null
  capabilities: string[] | null
  contextWindow: number | null
  maxOutputTokens: number | null
  supportsStreaming: boolean
  supportsTools: boolean
  supportsVision: boolean
  inputPricePer1m: string | null
  outputPricePer1m: string | null
  cachedPricePer1m: string | null
  releaseDate: string | null
  deprecatedAt: string | null
  isActive: boolean
  notes: string | null
}

// ── Input types ──────────────────────────────────────────────────────
export interface CreateProviderInput {
  slug: string
  name: string
  sdkAdapter: SdkAdapter
  baseUrl?: string | null
  apiKey?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface UpdateProviderInput {
  name?: string
  sdkAdapter?: SdkAdapter
  baseUrl?: string | null
  notes?: string | null
  isActive?: boolean
}

export interface RotateKeyInput {
  apiKey: string
}

export interface CreateModelInput {
  modelId: string
  displayName?: string | null
  capabilities?: string[] | null
  contextWindow?: number | null
  maxOutputTokens?: number | null
  supportsStreaming?: boolean
  supportsTools?: boolean
  supportsVision?: boolean
  inputPricePer1m?: string | null
  outputPricePer1m?: string | null
  cachedPricePer1m?: string | null
  releaseDate?: string | null
  notes?: string | null
  isActive?: boolean
}

export type UpdateModelInput = Partial<CreateModelInput>

// ── Helpers ──────────────────────────────────────────────────────────
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/** Compute last 4 chars of the plaintext key from the encrypted ciphertext. */
function computeLast4(encrypted: string | null): string | null {
  if (!encrypted) return null
  try {
    const plain = decryptApiKey(encrypted)
    return plain.slice(-4)
  } catch {
    // Bad ciphertext / wrong master key — surface as "unknown" so the UI
    // still renders without crashing. Admins can rotate to fix.
    return null
  }
}

function toProviderDto(row: ProviderRow, models: ProviderModelSummary[]): ProviderDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    sdkAdapter: row.sdkAdapter as SdkAdapter,
    baseUrl: row.baseUrl ?? null,
    apiKeyLast4: computeLast4(row.apiKeyEncrypted ?? null),
    isActive: row.isActive,
    notes: row.notes ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    models,
  }
}

function toModelDto(row: ModelRow, provider: { name: string; slug: string }): ModelDto {
  return {
    id: row.id,
    providerId: row.providerId,
    providerName: provider.name,
    providerSlug: provider.slug,
    modelId: row.modelId,
    displayName: row.displayName ?? null,
    capabilities: row.capabilities ?? null,
    contextWindow: row.contextWindow ?? null,
    maxOutputTokens: row.maxOutputTokens ?? null,
    supportsStreaming: row.supportsStreaming,
    supportsTools: row.supportsTools,
    supportsVision: row.supportsVision,
    inputPricePer1m: row.inputPricePer1m ?? null,
    outputPricePer1m: row.outputPricePer1m ?? null,
    cachedPricePer1m: row.cachedPricePer1m ?? null,
    releaseDate: row.releaseDate ?? null,
    deprecatedAt: row.deprecatedAt ?? null,
    isActive: row.isActive,
    notes: row.notes ?? null,
  }
}

function toModelSummary(row: ModelRow): ProviderModelSummary {
  return {
    id: row.id,
    modelId: row.modelId,
    displayName: row.displayName ?? null,
    capabilities: row.capabilities ?? null,
    contextWindow: row.contextWindow ?? null,
    maxOutputTokens: row.maxOutputTokens ?? null,
    inputPricePer1m: row.inputPricePer1m ?? null,
    outputPricePer1m: row.outputPricePer1m ?? null,
    isActive: row.isActive,
  }
}

async function findProviderById(id: string): Promise<ProviderRow | undefined> {
  return db.query.aiProviders.findFirst({
    where: and(eq(aiProviders.id, id), isNull(aiProviders.deletedAt)),
  })
}

async function findModelById(id: string): Promise<ModelRow | undefined> {
  return db.query.aiModels.findFirst({
    where: and(eq(aiModels.id, id), isNull(aiModels.deletedAt)),
  })
}

// ── Providers: list ──────────────────────────────────────────────────
export async function listProviders(): Promise<ProviderDto[]> {
  const [providers, models] = await Promise.all([
    db
      .select()
      .from(aiProviders)
      .where(isNull(aiProviders.deletedAt))
      .orderBy(asc(aiProviders.name)),
    db.select().from(aiModels).where(isNull(aiModels.deletedAt)),
  ])

  const modelsByProvider = new Map<string, ProviderModelSummary[]>()
  for (const m of models) {
    const list = modelsByProvider.get(m.providerId) ?? []
    list.push(toModelSummary(m))
    modelsByProvider.set(m.providerId, list)
  }
  // Sort each provider's models by modelId for stable output.
  for (const list of modelsByProvider.values()) {
    list.sort((a, b) => a.modelId.localeCompare(b.modelId))
  }

  return providers.map((p) => toProviderDto(p, modelsByProvider.get(p.id) ?? []))
}

// ── Providers: get ───────────────────────────────────────────────────
export async function getProviderById(id: string): Promise<ProviderDto> {
  const provider = await findProviderById(id)
  if (!provider) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${id}`)
  const models = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.providerId, id), isNull(aiModels.deletedAt)))
    .orderBy(asc(aiModels.modelId))
  return toProviderDto(provider, models.map(toModelSummary))
}

// ── Providers: create ────────────────────────────────────────────────
export async function createProvider(
  input: CreateProviderInput,
  actorId: string | null,
): Promise<ProviderDto> {
  const slug = input.slug.trim().toLowerCase()
  const name = input.name.trim()
  if (!SLUG_RE.test(slug)) {
    throw new ApiError('VALIDATION_ERROR', 'Slug provider tidak valid', {
      fieldErrors: { slug: 'Hanya huruf kecil, angka, dan tanda hubung.' },
    })
  }
  if (!name) {
    throw new ApiError('VALIDATION_ERROR', 'Nama provider wajib diisi', {
      fieldErrors: { name: 'Wajib diisi' },
    })
  }

  // Slug must be unique among active rows.
  const clash = await db.query.aiProviders.findFirst({
    where: and(eq(aiProviders.slug, slug), isNull(aiProviders.deletedAt)),
  })
  if (clash) {
    throw new ApiError('CONFLICT', `Slug "${slug}" sudah dipakai`, {
      fieldErrors: { slug: 'Slug sudah dipakai' },
    })
  }

  const encrypted = input.apiKey && input.apiKey.trim() ? encryptApiKey(input.apiKey.trim()) : null

  const values: ProviderInsert = {
    slug,
    name,
    sdkAdapter: input.sdkAdapter,
    baseUrl: input.baseUrl?.trim() || null,
    apiKeyEncrypted: encrypted,
    notes: input.notes?.trim() || null,
    isActive: input.isActive ?? Boolean(encrypted),
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  }

  const [row] = await db.insert(aiProviders).values(values).returning()
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Gagal membuat provider')

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'ai_provider',
    resourceId: row.id,
    // Don't write the encrypted blob into the audit diff — last4 is enough.
    diff: {
      after: {
        slug: row.slug,
        name: row.name,
        sdkAdapter: row.sdkAdapter,
        baseUrl: row.baseUrl,
        isActive: row.isActive,
        apiKeyLast4: computeLast4(row.apiKeyEncrypted ?? null),
      },
    },
  })

  return toProviderDto(row, [])
}

// ── Providers: update (metadata) ─────────────────────────────────────
export async function updateProvider(
  id: string,
  input: UpdateProviderInput,
  actorId: string | null,
): Promise<ProviderDto> {
  const before = await findProviderById(id)
  if (!before) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${id}`)

  const patch: Partial<ProviderInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.sdkAdapter !== undefined) patch.sdkAdapter = input.sdkAdapter
  if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl?.trim() || null
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.isActive !== undefined) {
    // Activating without an API key is meaningless — refuse.
    if (input.isActive && !before.apiKeyEncrypted) {
      throw new ApiError(
        'CONFLICT',
        'Tidak bisa mengaktifkan provider tanpa API key. Set key dulu via Rotate.',
      )
    }
    patch.isActive = input.isActive
  }

  const [row] = await db.update(aiProviders).set(patch).where(eq(aiProviders.id, id)).returning()
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Gagal update provider')

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'ai_provider',
    resourceId: id,
    diff: {
      before: {
        name: before.name,
        sdkAdapter: before.sdkAdapter,
        baseUrl: before.baseUrl,
        isActive: before.isActive,
        notes: before.notes,
      },
      after: {
        name: row.name,
        sdkAdapter: row.sdkAdapter,
        baseUrl: row.baseUrl,
        isActive: row.isActive,
        notes: row.notes,
      },
    },
  })

  // Reuse get to include models in the response.
  return getProviderById(id)
}

// ── Providers: rotate key ────────────────────────────────────────────
export async function rotateProviderKey(
  id: string,
  input: RotateKeyInput,
  actorId: string | null,
): Promise<{ apiKeyLast4: string }> {
  const before = await findProviderById(id)
  if (!before) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${id}`)

  const key = input.apiKey.trim()
  if (!key) {
    throw new ApiError('VALIDATION_ERROR', 'API key wajib diisi', {
      fieldErrors: { apiKey: 'Wajib diisi' },
    })
  }

  const encrypted = encryptApiKey(key)
  const [row] = await db
    .update(aiProviders)
    .set({
      apiKeyEncrypted: encrypted,
      updatedAt: new Date(),
      updatedBy: actorId ?? null,
    })
    .where(eq(aiProviders.id, id))
    .returning()
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Gagal menyimpan API key')

  await auditLog.write({
    actorId,
    action: 'config_change',
    resourceType: 'ai_provider',
    resourceId: id,
    diff: {
      rotated: true,
      apiKeyLast4: [computeLast4(before.apiKeyEncrypted ?? null), key.slice(-4)],
    },
  })

  return { apiKeyLast4: key.slice(-4) }
}

// ── Providers: soft delete ───────────────────────────────────────────
export async function softDeleteProvider(id: string, actorId: string | null): Promise<void> {
  const before = await findProviderById(id)
  if (!before) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${id}`)

  // Refuse if any active assignment still points at one of this provider's
  // models — admin must reassign first to avoid breaking the runtime.
  const stuck = await db
    .select({ role: aiRoleAssignments.role, modelId: aiModels.modelId })
    .from(aiRoleAssignments)
    .innerJoin(aiModels, eq(aiModels.id, aiRoleAssignments.modelId))
    .where(
      and(
        eq(aiModels.providerId, id),
        isNull(aiRoleAssignments.deletedAt),
        isNull(aiModels.deletedAt),
      ),
    )
  if (stuck.length > 0) {
    const roles = stuck.map((r) => r.role).join(', ')
    throw new ApiError(
      'CONFLICT',
      `Provider masih dipakai oleh role: ${roles}. Pindahkan role ke provider lain dulu.`,
    )
  }

  const now = new Date()
  // Cascade soft-delete to models so the registry won't pick them up.
  await db.batch([
    db
      .update(aiProviders)
      .set({ deletedAt: now, deletedBy: actorId ?? null, isActive: false, updatedBy: actorId ?? null })
      .where(eq(aiProviders.id, id)),
    db
      .update(aiModels)
      .set({ deletedAt: now, deletedBy: actorId ?? null, isActive: false, updatedBy: actorId ?? null })
      .where(and(eq(aiModels.providerId, id), isNull(aiModels.deletedAt))),
  ])

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'ai_provider',
    resourceId: id,
    diff: { slug: before.slug, name: before.name },
  })
}

// ── Providers: test connection ───────────────────────────────────────
/**
 * Smoke-test a provider's API key by attempting a no-op request. Returns
 * `{ ok: true }` on success, otherwise `{ ok: false, message }`.
 *
 * The implementation is intentionally cheap: we just verify the key
 * decrypts and try a minimal HTTP GET against the provider's typical
 * "list models" endpoint when known.
 */
export async function testProvider(id: string): Promise<{ ok: boolean; message?: string }> {
  const provider = await findProviderById(id)
  if (!provider) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${id}`)
  if (!provider.apiKeyEncrypted) {
    return { ok: false, message: 'Belum ada API key.' }
  }

  let apiKey: string
  try {
    apiKey = decryptApiKey(provider.apiKeyEncrypted)
  } catch (err) {
    return { ok: false, message: `Gagal decrypt API key: ${(err as Error).message}` }
  }

  // Map each adapter to its known "GET /models" probe. If we don't know
  // the provider, treat presence-of-key as success — better than false
  // negatives on custom self-hosted endpoints.
  const probes: Record<SdkAdapter, { url: string; auth: 'bearer' | 'x-api-key' } | null> = {
    'openai-compatible': {
      url: (provider.baseUrl ?? 'https://api.openai.com/v1') + '/models',
      auth: 'bearer',
    },
    deepseek: {
      url: (provider.baseUrl ?? 'https://api.deepseek.com') + '/models',
      auth: 'bearer',
    },
    anthropic: { url: 'https://api.anthropic.com/v1/models', auth: 'x-api-key' },
    google: {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      auth: 'bearer', // not used for google
    },
    custom: null,
  }

  const probe = probes[provider.sdkAdapter as SdkAdapter]
  if (!probe) return { ok: true, message: 'Adapter custom — tidak diuji.' }

  try {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    if (provider.sdkAdapter === 'anthropic') {
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else if (provider.sdkAdapter !== 'google') {
      headers['authorization'] = `Bearer ${apiKey}`
    }
    const res = await fetch(probe.url, { method: 'GET', headers })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        message: `HTTP ${res.status}: ${text.slice(0, 160) || res.statusText}`,
      }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, message: (err as Error).message }
  }
}

// ── Models: list (all, joined with provider) ─────────────────────────
export async function listModels(): Promise<ModelDto[]> {
  const rows = await db
    .select({
      model: aiModels,
      providerName: aiProviders.name,
      providerSlug: aiProviders.slug,
    })
    .from(aiModels)
    .innerJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(and(isNull(aiModels.deletedAt), isNull(aiProviders.deletedAt)))
    .orderBy(asc(aiProviders.name), asc(aiModels.modelId))

  return rows.map((r) => toModelDto(r.model, { name: r.providerName, slug: r.providerSlug }))
}

export async function listProviderModels(providerId: string): Promise<ModelDto[]> {
  const provider = await findProviderById(providerId)
  if (!provider) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${providerId}`)
  const rows = await db
    .select()
    .from(aiModels)
    .where(and(eq(aiModels.providerId, providerId), isNull(aiModels.deletedAt)))
    .orderBy(asc(aiModels.modelId))
  return rows.map((r) => toModelDto(r, { name: provider.name, slug: provider.slug }))
}

// ── Models: get ──────────────────────────────────────────────────────
export async function getModelById(id: string): Promise<ModelDto> {
  const rows = await db
    .select({
      model: aiModels,
      providerName: aiProviders.name,
      providerSlug: aiProviders.slug,
    })
    .from(aiModels)
    .innerJoin(aiProviders, eq(aiModels.providerId, aiProviders.id))
    .where(and(eq(aiModels.id, id), isNull(aiModels.deletedAt)))
    .limit(1)
  const row = rows[0]
  if (!row) throw new ApiError('NOT_FOUND', `Model tidak ditemukan: ${id}`)
  return toModelDto(row.model, { name: row.providerName, slug: row.providerSlug })
}

// ── Models: create ───────────────────────────────────────────────────
export async function createModel(
  providerId: string,
  input: CreateModelInput,
  actorId: string | null,
): Promise<ModelDto> {
  const provider = await findProviderById(providerId)
  if (!provider) throw new ApiError('NOT_FOUND', `Provider tidak ditemukan: ${providerId}`)

  const modelId = input.modelId.trim()
  if (!modelId) {
    throw new ApiError('VALIDATION_ERROR', 'Model ID wajib diisi', {
      fieldErrors: { modelId: 'Wajib diisi' },
    })
  }

  // Unique within provider (among active rows).
  const clash = await db.query.aiModels.findFirst({
    where: and(
      eq(aiModels.providerId, providerId),
      eq(aiModels.modelId, modelId),
      isNull(aiModels.deletedAt),
    ),
  })
  if (clash) {
    throw new ApiError('CONFLICT', `Model "${modelId}" sudah terdaftar di provider ini.`, {
      fieldErrors: { modelId: 'Sudah ada' },
    })
  }

  const values: ModelInsert = {
    providerId,
    modelId,
    displayName: input.displayName ?? null,
    capabilities: input.capabilities ?? null,
    contextWindow: input.contextWindow ?? null,
    maxOutputTokens: input.maxOutputTokens ?? null,
    supportsStreaming: input.supportsStreaming ?? true,
    supportsTools: input.supportsTools ?? false,
    supportsVision: input.supportsVision ?? false,
    inputPricePer1m: input.inputPricePer1m ?? null,
    outputPricePer1m: input.outputPricePer1m ?? null,
    cachedPricePer1m: input.cachedPricePer1m ?? null,
    releaseDate: input.releaseDate ?? null,
    isActive: input.isActive ?? false,
    notes: input.notes ?? null,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  }

  const [row] = await db.insert(aiModels).values(values).returning()
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Gagal membuat model')

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'ai_model',
    resourceId: row.id,
    diff: { after: { providerId, modelId: row.modelId, displayName: row.displayName } },
  })

  return toModelDto(row, { name: provider.name, slug: provider.slug })
}

// ── Models: update ───────────────────────────────────────────────────
export async function updateModel(
  id: string,
  input: UpdateModelInput,
  actorId: string | null,
): Promise<ModelDto> {
  const before = await findModelById(id)
  if (!before) throw new ApiError('NOT_FOUND', `Model tidak ditemukan: ${id}`)

  // If modelId changes, check uniqueness within provider.
  if (input.modelId !== undefined && input.modelId !== before.modelId) {
    const trimmed = input.modelId.trim()
    if (!trimmed) {
      throw new ApiError('VALIDATION_ERROR', 'Model ID tidak boleh kosong', {
        fieldErrors: { modelId: 'Wajib diisi' },
      })
    }
    const clash = await db.query.aiModels.findFirst({
      where: and(
        eq(aiModels.providerId, before.providerId),
        eq(aiModels.modelId, trimmed),
        isNull(aiModels.deletedAt),
        ne(aiModels.id, id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Model "${trimmed}" sudah terdaftar di provider ini.`, {
        fieldErrors: { modelId: 'Sudah ada' },
      })
    }
  }

  const patch: Partial<ModelInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.modelId !== undefined) patch.modelId = input.modelId.trim()
  if (input.displayName !== undefined) patch.displayName = input.displayName
  if (input.capabilities !== undefined) patch.capabilities = input.capabilities
  if (input.contextWindow !== undefined) patch.contextWindow = input.contextWindow
  if (input.maxOutputTokens !== undefined) patch.maxOutputTokens = input.maxOutputTokens
  if (input.supportsStreaming !== undefined) patch.supportsStreaming = input.supportsStreaming
  if (input.supportsTools !== undefined) patch.supportsTools = input.supportsTools
  if (input.supportsVision !== undefined) patch.supportsVision = input.supportsVision
  if (input.inputPricePer1m !== undefined) patch.inputPricePer1m = input.inputPricePer1m
  if (input.outputPricePer1m !== undefined) patch.outputPricePer1m = input.outputPricePer1m
  if (input.cachedPricePer1m !== undefined) patch.cachedPricePer1m = input.cachedPricePer1m
  if (input.releaseDate !== undefined) patch.releaseDate = input.releaseDate
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.isActive !== undefined) patch.isActive = input.isActive

  await db.update(aiModels).set(patch).where(eq(aiModels.id, id))

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'ai_model',
    resourceId: id,
    diff: { before, patch },
  })

  return getModelById(id)
}

// ── Models: soft delete ──────────────────────────────────────────────
export async function softDeleteModel(id: string, actorId: string | null): Promise<void> {
  const before = await findModelById(id)
  if (!before) throw new ApiError('NOT_FOUND', `Model tidak ditemukan: ${id}`)

  // Refuse if currently assigned to any active role.
  const stuck = await db
    .select({ role: aiRoleAssignments.role })
    .from(aiRoleAssignments)
    .where(and(eq(aiRoleAssignments.modelId, id), isNull(aiRoleAssignments.deletedAt)))
  if (stuck.length > 0) {
    throw new ApiError(
      'CONFLICT',
      `Model sedang dipakai oleh role: ${stuck.map((r) => r.role).join(', ')}. Pindahkan dulu.`,
    )
  }

  await db
    .update(aiModels)
    .set({
      deletedAt: new Date(),
      deletedBy: actorId ?? null,
      isActive: false,
      updatedBy: actorId ?? null,
    })
    .where(eq(aiModels.id, id))

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'ai_model',
    resourceId: id,
    diff: { modelId: before.modelId, providerId: before.providerId },
  })
}

// ── Role assignments: list ───────────────────────────────────────────
export interface RoleAssignmentDto {
  role: AIRole
  modelId: string | null
  providerName: string | null
  providerSlug: string | null
  modelDisplay: string | null
  inputPricePer1m: string | null
  outputPricePer1m: string | null
}

export interface ActiveModelOption {
  id: string
  providerName: string
  providerSlug: string
  modelId: string
  displayName: string | null
  inputPricePer1m: string | null
  outputPricePer1m: string | null
}

export interface RoleAssignmentsPayload {
  assignments: RoleAssignmentDto[]
  models: ActiveModelOption[]
}

export async function listRoleAssignments(): Promise<RoleAssignmentsPayload> {
  // 1. Current assignments — left join so every seeded role surfaces even
  //    when no row exists yet.
  const current = await db
    .select({
      role: aiRoleAssignments.role,
      modelId: aiModels.id,
      modelDisplay: aiModels.displayName,
      modelSlug: aiModels.modelId,
      inputPricePer1m: aiModels.inputPricePer1m,
      outputPricePer1m: aiModels.outputPricePer1m,
      providerName: aiProviders.name,
      providerSlug: aiProviders.slug,
    })
    .from(aiRoleAssignments)
    .innerJoin(aiModels, eq(aiModels.id, aiRoleAssignments.modelId))
    .innerJoin(aiProviders, eq(aiProviders.id, aiModels.providerId))
    .where(
      and(
        isNull(aiRoleAssignments.deletedAt),
        isNull(aiModels.deletedAt),
        isNull(aiProviders.deletedAt),
      ),
    )

  const byRole = new Map<string, RoleAssignmentDto>()
  for (const r of current) {
    byRole.set(r.role, {
      role: r.role as AIRole,
      modelId: r.modelId,
      providerName: r.providerName,
      providerSlug: r.providerSlug,
      modelDisplay: r.modelDisplay ?? r.modelSlug,
      inputPricePer1m: r.inputPricePer1m ?? null,
      outputPricePer1m: r.outputPricePer1m ?? null,
    })
  }

  const assignments: RoleAssignmentDto[] = AI_ROLES.map(
    (role) =>
      byRole.get(role) ?? {
        role,
        modelId: null,
        providerName: null,
        providerSlug: null,
        modelDisplay: null,
        inputPricePer1m: null,
        outputPricePer1m: null,
      },
  )

  // 2. Active models — only models from active providers with a key.
  const activeRows = await db
    .select({ model: aiModels, providerName: aiProviders.name, providerSlug: aiProviders.slug })
    .from(aiModels)
    .innerJoin(aiProviders, eq(aiProviders.id, aiModels.providerId))
    .where(
      and(
        eq(aiModels.isActive, true),
        eq(aiProviders.isActive, true),
        isNull(aiModels.deletedAt),
        isNull(aiProviders.deletedAt),
      ),
    )
    .orderBy(asc(aiProviders.name), asc(aiModels.modelId))

  const models: ActiveModelOption[] = activeRows.map((r) => ({
    id: r.model.id,
    providerName: r.providerName,
    providerSlug: r.providerSlug,
    modelId: r.model.modelId,
    displayName: r.model.displayName ?? null,
    inputPricePer1m: r.model.inputPricePer1m ?? null,
    outputPricePer1m: r.model.outputPricePer1m ?? null,
  }))

  return { assignments, models }
}

// ── Role assignments: set ────────────────────────────────────────────
export interface SetAssignmentInput {
  role: AIRole
  modelId: string
}

export async function setRoleAssignment(
  input: SetAssignmentInput,
  actorId: string | null,
): Promise<AssignmentRow> {
  const model = await db.query.aiModels.findFirst({
    where: and(eq(aiModels.id, input.modelId), isNull(aiModels.deletedAt)),
  })
  if (!model) throw new ApiError('NOT_FOUND', `Model tidak ditemukan: ${input.modelId}`)
  if (!model.isActive) {
    throw new ApiError(
      'CONFLICT',
      'Model belum aktif. Aktifkan model di tab "Models" terlebih dahulu.',
    )
  }
  // Provider must also be active.
  const provider = await db.query.aiProviders.findFirst({
    where: and(eq(aiProviders.id, model.providerId), isNull(aiProviders.deletedAt)),
  })
  if (!provider) {
    throw new ApiError('NOT_FOUND', `Provider model tidak ditemukan.`)
  }
  if (!provider.isActive) {
    throw new ApiError('CONFLICT', `Provider "${provider.name}" belum aktif.`)
  }
  if (!provider.apiKeyEncrypted) {
    throw new ApiError('CONFLICT', `Provider "${provider.name}" belum punya API key.`)
  }

  const existing = await db.query.aiRoleAssignments.findFirst({
    where: and(
      eq(aiRoleAssignments.role, input.role),
      isNull(aiRoleAssignments.deletedAt),
    ),
  })

  const oldModelId = existing?.modelId ?? null
  if (existing && existing.modelId === input.modelId) {
    // No-op — still audit so the action is observable.
    await auditLog.write({
      actorId,
      action: 'config_change',
      resourceType: 'ai_role_assignment',
      resourceId: existing.id,
      diff: { role: input.role, modelId: [input.modelId, input.modelId], note: 'no-op' },
    })
    return existing
  }

  // The `(role)` unique-where index guarantees at most one active row per
  // role. Replace atomically via batch.
  const insertNew = db
    .insert(aiRoleAssignments)
    .values({
      role: input.role,
      modelId: input.modelId,
      activatedBy: actorId ?? null,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    })
    .returning()

  let inserted: AssignmentRow | undefined
  if (existing) {
    const results = await db.batch([
      db.delete(aiRoleAssignments).where(eq(aiRoleAssignments.id, existing.id)),
      insertNew,
    ])
    inserted = results[1][0]
  } else {
    const results = await db.batch([insertNew])
    inserted = results[0][0]
  }
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Gagal menyimpan role assignment')

  await auditLog.write({
    actorId,
    action: 'config_change',
    resourceType: 'ai_role_assignment',
    resourceId: inserted.id,
    diff: { role: input.role, modelId: [oldModelId, input.modelId] },
  })

  return inserted
}

// ── Namespaced default export ────────────────────────────────────────
export const aiProviderService = {
  listProviders,
  getProviderById,
  createProvider,
  updateProvider,
  rotateProviderKey,
  softDeleteProvider,
  testProvider,
  listModels,
  listProviderModels,
  getModelById,
  createModel,
  updateModel,
  softDeleteModel,
  listRoleAssignments,
  setRoleAssignment,
}

// Re-export for callers that prefer importing the original encryption helpers.
export { encryptApiKey, decryptApiKey }
