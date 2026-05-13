// Whitelist domain service — manages the citation-source whitelist used by
// the AI crawler.  Admin-only (`whitelist.manage`).  Every mutation is
// audit-logged.  See docs/BACKEND.md §10 (Citations) + DATABASE.md §7.

import { and, asc, eq, isNull, ne } from 'drizzle-orm'

import { db } from '@athar/db'
import { whitelistDomains } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { auditLog } from './audit.service.js'

export type WhitelistDomainRow = typeof whitelistDomains.$inferSelect
type WhitelistDomainInsert = typeof whitelistDomains.$inferInsert

export type WhitelistPrimaryLanguage = 'ar' | 'id' | 'en'

export interface CreateWhitelistInput {
  domain: string
  displayName?: string | null
  primaryLanguage?: WhitelistPrimaryLanguage | null
  description?: string | null
  priority?: number
  crawlRatePerMinute?: number
  isActive?: boolean
}

export interface UpdateWhitelistInput {
  domain?: string
  displayName?: string | null
  primaryLanguage?: WhitelistPrimaryLanguage | null
  description?: string | null
  priority?: number
  crawlRatePerMinute?: number
  isActive?: boolean
}

/**
 * List every whitelist row that is not hard-deleted (includes inactive +
 * soft-deleted rows so admins can audit history).  Active rows first
 * (by priority desc), soft-deleted at the bottom.
 */
export async function list(): Promise<WhitelistDomainRow[]> {
  return db
    .select()
    .from(whitelistDomains)
    .orderBy(
      asc(whitelistDomains.deletedAt),
      asc(whitelistDomains.domain),
    )
}

/**
 * Fetch a whitelist row by id (any state — used by update/delete flows).
 */
async function getById(id: string): Promise<WhitelistDomainRow> {
  const row = await db.query.whitelistDomains.findFirst({
    where: eq(whitelistDomains.id, id),
  })
  if (!row) throw new ApiError('NOT_FOUND', `Whitelist domain not found: ${id}`)
  return row
}

/**
 * Create a whitelist entry.  Refuses if the domain is already in use by an
 * active (non-soft-deleted) row.
 */
export async function create(
  input: CreateWhitelistInput,
  actorId: string | null,
): Promise<WhitelistDomainRow> {
  const existing = await db.query.whitelistDomains.findFirst({
    where: and(
      eq(whitelistDomains.domain, input.domain),
      isNull(whitelistDomains.deletedAt),
    ),
  })
  if (existing) {
    throw new ApiError('CONFLICT', `Domain sudah terdaftar: ${input.domain}`, {
      fieldErrors: { domain: 'Domain sudah terdaftar' },
    })
  }

  const values: WhitelistDomainInsert = {
    domain: input.domain,
    displayName: input.displayName ?? null,
    primaryLanguage: input.primaryLanguage ?? null,
    description: input.description ?? null,
    priority: input.priority ?? 0,
    crawlRatePerMinute: input.crawlRatePerMinute ?? 30,
    isActive: input.isActive ?? true,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  }

  const [inserted] = await db.insert(whitelistDomains).values(values).returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Failed to insert whitelist domain')

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'whitelist_domain',
    resourceId: inserted.id,
    diff: { after: inserted },
  })

  return inserted
}

/**
 * Update mutable fields on a whitelist row.  Refuses if a different active
 * row already owns the new domain.
 */
export async function update(
  id: string,
  input: UpdateWhitelistInput,
  actorId: string | null,
): Promise<WhitelistDomainRow> {
  const before = await getById(id)

  if (input.domain !== undefined && input.domain !== before.domain) {
    const clash = await db.query.whitelistDomains.findFirst({
      where: and(
        eq(whitelistDomains.domain, input.domain),
        isNull(whitelistDomains.deletedAt),
        ne(whitelistDomains.id, id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Domain sudah terdaftar: ${input.domain}`, {
        fieldErrors: { domain: 'Domain sudah terdaftar' },
      })
    }
  }

  const patch: Partial<WhitelistDomainInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.domain !== undefined) patch.domain = input.domain
  if (input.displayName !== undefined) patch.displayName = input.displayName
  if (input.primaryLanguage !== undefined) patch.primaryLanguage = input.primaryLanguage
  if (input.description !== undefined) patch.description = input.description
  if (input.priority !== undefined) patch.priority = input.priority
  if (input.crawlRatePerMinute !== undefined) patch.crawlRatePerMinute = input.crawlRatePerMinute
  if (input.isActive !== undefined) patch.isActive = input.isActive

  const [updated] = await db
    .update(whitelistDomains)
    .set(patch)
    .where(eq(whitelistDomains.id, id))
    .returning()
  if (!updated) throw new ApiError('INTERNAL_ERROR', 'Failed to update whitelist domain')

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'whitelist_domain',
    resourceId: id,
    diff: { before, after: updated },
  })

  return updated
}

/**
 * Soft-delete a whitelist row.  Sets `deleted_at = now()` so the unique
 * partial index on `(domain) WHERE deleted_at IS NULL` allows the domain
 * to be re-added later.
 */
export async function softDelete(id: string, actorId: string | null): Promise<void> {
  const row = await getById(id)
  if (row.deletedAt) {
    throw new ApiError('CONFLICT', 'Whitelist domain already deleted')
  }

  const now = new Date()
  await db
    .update(whitelistDomains)
    .set({
      deletedAt: now,
      deletedBy: actorId ?? null,
      updatedAt: now,
      updatedBy: actorId ?? null,
      isActive: false,
    })
    .where(eq(whitelistDomains.id, id))

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'whitelist_domain',
    resourceId: id,
    diff: { domain: row.domain },
  })
}

export const whitelistService = {
  list,
  create,
  update,
  softDelete,
}
