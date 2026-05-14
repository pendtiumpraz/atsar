// User service — admin CRUD + invite flow + role assignment.
// See docs/BACKEND.md §5 (RBAC) and §11 (audit logging).
//
// Invite flow creates a user row with no password_hash and issues an
// email-verification token; the actual magic-link email is enqueued via the
// `mail` worker queue (TODO until the mail job lands — see comment below).

import crypto from 'node:crypto'

import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'

import { db } from '@athar/db'
import {
  emailVerificationTokens,
  roles,
  userRoles,
  users,
} from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { invalidatePermissions } from '@/lib/server/rbac'
import { auditLog } from './audit.service.js'

/** Row shape returned by list/get. */
export type UserRow = typeof users.$inferSelect

/** User joined with their assigned role ids. */
export interface UserWithRoles extends UserRow {
  roleIds: string[]
  roleSlugs: string[]
}

export interface ListUsersInput {
  q?: string
  role?: string // role slug (admin/reviewer/subscriber/custom)
  status?: 'active' | 'unverified' | 'deleted'
  page?: number
  perPage?: number
}

export interface ListUsersResult {
  rows: UserWithRoles[]
  total: number
}

/** Hash a verification token for storage (we store hash, hand out raw). */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * List users matching the optional filters, paginated.
 *
 * - `q`: ilike against `email` and `full_name`.
 * - `role`: slug filter, joins through `user_roles` → `roles`.
 * - `status`: `active` = verified + not deleted; `unverified` = no email
 *   verification yet; `deleted` = soft-deleted.
 */
export async function list(input: ListUsersInput): Promise<ListUsersResult> {
  const page = input.page ?? 1
  const perPage = input.perPage ?? 20
  const filters: SQL[] = []

  if (input.status === 'deleted') {
    filters.push(sql`${users.deletedAt} IS NOT NULL`)
  } else {
    filters.push(isNull(users.deletedAt))
    if (input.status === 'active') {
      filters.push(sql`${users.emailVerifiedAt} IS NOT NULL`)
    } else if (input.status === 'unverified') {
      filters.push(sql`${users.emailVerifiedAt} IS NULL`)
    }
  }

  if (input.q && input.q.trim().length > 0) {
    const pattern = `%${input.q.trim()}%`
    filters.push(
      or(ilike(users.email, pattern), ilike(users.fullName, pattern))!,
    )
  }

  if (input.role) {
    // Restrict to users that have at least one row in user_roles for the role
    // with the given slug.
    const sub = db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .innerJoin(
        roles,
        and(eq(roles.id, userRoles.roleId), eq(roles.slug, input.role), isNull(roles.deletedAt)),
      )
    filters.push(inArray(users.id, sub))
  }

  const where = filters.length > 0 ? and(...filters) : undefined
  const offset = (page - 1) * perPage

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(perPage)
      .offset(offset),
    db.select({ c: sql<number>`count(*)::int` }).from(users).where(where),
  ])

  const ids = rows.map((u) => u.id)
  const roleRows = ids.length
    ? await db
        .select({
          userId: userRoles.userId,
          roleId: userRoles.roleId,
          slug: roles.slug,
        })
        .from(userRoles)
        .innerJoin(
          roles,
          and(eq(roles.id, userRoles.roleId), isNull(roles.deletedAt)),
        )
        .where(inArray(userRoles.userId, ids))
    : []

  const byUser = new Map<string, { roleIds: string[]; roleSlugs: string[] }>()
  for (const r of roleRows) {
    let agg = byUser.get(r.userId)
    if (!agg) {
      agg = { roleIds: [], roleSlugs: [] }
      byUser.set(r.userId, agg)
    }
    agg.roleIds.push(r.roleId)
    agg.roleSlugs.push(r.slug)
  }

  const withRoles: UserWithRoles[] = rows.map((u) => {
    const agg = byUser.get(u.id) ?? { roleIds: [], roleSlugs: [] }
    return { ...u, roleIds: agg.roleIds, roleSlugs: agg.roleSlugs }
  })

  return { rows: withRoles, total: (totalRow[0]?.c as number | undefined) ?? 0 }
}

/**
 * Fetch a user by id (including soft-deleted — caller decides whether to
 * surface). Throws `NOT_FOUND` if the row doesn't exist at all.
 */
export async function getById(id: string): Promise<UserWithRoles> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
  const user = rows[0]
  if (!user) {
    throw new ApiError('NOT_FOUND', 'User tidak ditemukan')
  }

  const roleRows = await db
    .select({ roleId: userRoles.roleId, slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), isNull(roles.deletedAt)))
    .where(eq(userRoles.userId, id))
    .orderBy(asc(roles.slug))

  return {
    ...user,
    roleIds: roleRows.map((r) => r.roleId),
    roleSlugs: roleRows.map((r) => r.slug),
  }
}

export interface InviteInput {
  email: string
  fullName: string
  roleSlug: string
}

export interface InviteResult {
  userId: string
  invitationToken: string
  expiresAt: Date
}

/**
 * Create a passwordless user + verification token. The caller is expected
 * to enqueue a magic-link email containing the token.
 *
 * Throws `CONFLICT` if an active user with the same email exists, or
 * `VALIDATION_ERROR` if `roleSlug` doesn't match an active role.
 */
export async function invite(
  input: InviteInput,
  actorId: string | null,
): Promise<InviteResult> {
  // Ensure email is free.
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
    .limit(1)
  if (existing.length > 0) {
    throw new ApiError('CONFLICT', 'Email sudah terdaftar')
  }

  // Resolve role.
  const roleRows = await db
    .select()
    .from(roles)
    .where(and(eq(roles.slug, input.roleSlug), isNull(roles.deletedAt)))
    .limit(1)
  const role = roleRows[0]
  if (!role) {
    throw new ApiError('VALIDATION_ERROR', `Role "${input.roleSlug}" tidak ditemukan`)
  }

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days

  // Neon HTTP driver doesn't support `db.transaction` — insert the user
  // first so we have its id, then batch the dependent FK rows. `db.batch`
  // gives single-round-trip atomicity for the dependent inserts; if the
  // batch fails the user row is left dangling but the email-verification
  // token never lands, so the user can't sign in regardless.
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      fullName: input.fullName,
      displayName: input.fullName,
      locale: 'id',
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    })
    .returning()

  if (!user) {
    throw new ApiError('INTERNAL_ERROR', 'Gagal membuat user')
  }

  await db.batch([
    db.insert(userRoles).values({
      userId: user.id,
      roleId: role.id,
      assignedBy: actorId ?? null,
    }),
    db.insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    }),
  ])

  const result = user

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'user',
    resourceId: result.id,
    diff: {
      email: [null, input.email],
      fullName: [null, input.fullName],
      roleSlug: [null, input.roleSlug],
    },
  })

  // TODO(mail): enqueue `mail` job with magic-link email containing
  // `${APP_URL}/auth/verify?token=${rawToken}`. Handled by Agent 6 / worker.

  return {
    userId: result.id,
    invitationToken: rawToken,
    expiresAt,
  }
}

export interface UpdateUserInput {
  fullName?: string
  displayName?: string | null
  phone?: string | null
  locale?: 'id' | 'ar' | 'en'
}

/**
 * Update mutable profile fields on a user. Audit-logs the change.
 */
export async function update(
  id: string,
  input: UpdateUserInput,
  actorId: string | null,
): Promise<UserRow> {
  const before = await db.select().from(users).where(eq(users.id, id)).limit(1)
  const prev = before[0]
  if (!prev) {
    throw new ApiError('NOT_FOUND', 'User tidak ditemukan')
  }

  const patch: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.fullName !== undefined) patch.fullName = input.fullName
  if (input.displayName !== undefined) patch.displayName = input.displayName
  if (input.phone !== undefined) patch.phone = input.phone
  if (input.locale !== undefined) patch.locale = input.locale

  const [row] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, id))
    .returning()

  if (!row) {
    throw new ApiError('NOT_FOUND', 'User tidak ditemukan')
  }

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'user',
    resourceId: id,
    diff: {
      ...(input.fullName !== undefined && input.fullName !== prev.fullName
        ? { fullName: [prev.fullName, row.fullName] }
        : {}),
      ...(input.displayName !== undefined && input.displayName !== prev.displayName
        ? { displayName: [prev.displayName, row.displayName] }
        : {}),
      ...(input.phone !== undefined && input.phone !== prev.phone
        ? { phone: [prev.phone, row.phone] }
        : {}),
      ...(input.locale !== undefined && input.locale !== prev.locale
        ? { locale: [prev.locale, row.locale] }
        : {}),
    },
  })

  return row
}

/**
 * Replace the user's role assignments atomically via `db.batch` (Neon HTTP
 * doesn't support `db.transaction`). Invalidates the effective-permission
 * cache for that user.
 */
export async function setRoles(
  userId: string,
  roleIds: string[],
  actorId: string | null,
): Promise<void> {
  // Verify user exists & not deleted.
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)
  if (userRows.length === 0) {
    throw new ApiError('NOT_FOUND', 'User tidak ditemukan')
  }

  // De-dupe and validate every role id resolves to an active role.
  const uniqueIds = Array.from(new Set(roleIds))
  if (uniqueIds.length > 0) {
    const found = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(inArray(roles.id, uniqueIds), isNull(roles.deletedAt)))
    if (found.length !== uniqueIds.length) {
      throw new ApiError('VALIDATION_ERROR', 'Salah satu role tidak ditemukan')
    }
  }

  // Neon HTTP driver doesn't support `db.transaction`. We model the same
  // "delete + insert" atomically with `db.batch` (Neon ships these as a
  // single multi-statement request). If `uniqueIds` is empty we still need
  // the delete, so issue it on its own.
  if (uniqueIds.length > 0) {
    await db.batch([
      db.delete(userRoles).where(eq(userRoles.userId, userId)),
      db.insert(userRoles).values(
        uniqueIds.map((roleId) => ({
          userId,
          roleId,
          assignedBy: actorId ?? null,
        })),
      ),
    ])
  } else {
    await db.delete(userRoles).where(eq(userRoles.userId, userId))
  }

  await auditLog.write({
    actorId,
    action: 'role_change',
    resourceType: 'user',
    resourceId: userId,
    diff: { roleIds: [null, uniqueIds] },
  })

  await invalidatePermissions(userId).catch(() => undefined)
}

/**
 * Soft-delete a user. Refuses with `CONFLICT` if the target is the last
 * remaining admin (we never want to lock ourselves out of the admin UI).
 */
export async function softDelete(id: string, actorId: string | null): Promise<void> {
  const user = await getById(id)
  if (user.deletedAt) {
    throw new ApiError('CONFLICT', 'User sudah dihapus')
  }

  // Last-admin guard: if this user has the admin role, ensure at least one
  // other active admin remains.
  if (user.roleSlugs.includes('admin')) {
    const otherAdmins = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(
        roles,
        and(eq(roles.id, userRoles.roleId), eq(roles.slug, 'admin'), isNull(roles.deletedAt)),
      )
      .where(and(isNull(users.deletedAt), sql`${users.id} <> ${id}`))
      .limit(1)
    if (otherAdmins.length === 0) {
      throw new ApiError('CONFLICT', 'Tidak bisa menghapus admin terakhir')
    }
  }

  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      deletedBy: actorId ?? null,
      updatedAt: new Date(),
      updatedBy: actorId ?? null,
    })
    .where(eq(users.id, id))

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'user',
    resourceId: id,
    diff: { email: [user.email, null] },
  })

  await invalidatePermissions(id).catch(() => undefined)
}
