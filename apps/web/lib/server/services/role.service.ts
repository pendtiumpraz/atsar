// Role + role-permission matrix service.
// See docs/BACKEND.md §5 (RBAC) — admin can create custom (non-system) roles
// and edit the permission matrix. System roles (admin/reviewer/subscriber)
// cannot be soft-deleted.

import { and, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { roles, rolePermissions, userRoles } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { invalidatePermissions } from '@/lib/server/rbac'
import { auditLog } from './audit.service.js'

/** Public row shape returned by list/get. */
export type RoleRow = typeof roles.$inferSelect

/** Input accepted by `create`. */
export interface CreateRoleInput {
  slug: string
  nameId: string
  nameAr?: string | null
  description?: string | null
}

/** Input accepted by `update`. All fields optional — partial patch. */
export interface UpdateRoleInput {
  slug?: string
  nameId?: string
  nameAr?: string | null
  description?: string | null
}

/**
 * List all non-soft-deleted roles, ordered by slug for stable UI.
 */
export async function list(): Promise<RoleRow[]> {
  return db
    .select()
    .from(roles)
    .where(isNull(roles.deletedAt))
    .orderBy(roles.slug)
}

/**
 * Fetch a role by id. Throws `NOT_FOUND` when missing or soft-deleted.
 */
export async function getById(id: string): Promise<RoleRow> {
  const rows = await db
    .select()
    .from(roles)
    .where(and(eq(roles.id, id), isNull(roles.deletedAt)))
    .limit(1)
  const row = rows[0]
  if (!row) {
    throw new ApiError('NOT_FOUND', 'Role tidak ditemukan')
  }
  return row
}

/**
 * Create a custom (non-system) role. `isSystem` is forced to `false`.
 * Throws `CONFLICT` if the slug is already taken by an active row.
 */
export async function create(
  input: CreateRoleInput,
  actorId: string | null,
): Promise<RoleRow> {
  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.slug, input.slug), isNull(roles.deletedAt)))
    .limit(1)
  if (existing.length > 0) {
    throw new ApiError('CONFLICT', `Role dengan slug "${input.slug}" sudah ada`)
  }

  const [row] = await db
    .insert(roles)
    .values({
      slug: input.slug,
      nameId: input.nameId,
      nameAr: input.nameAr ?? null,
      description: input.description ?? null,
      isSystem: false,
      createdBy: actorId ?? null,
      updatedBy: actorId ?? null,
    })
    .returning()

  if (!row) {
    throw new ApiError('INTERNAL_ERROR', 'Gagal membuat role')
  }

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'role',
    resourceId: row.id,
    diff: { slug: [null, row.slug], nameId: [null, row.nameId] },
  })

  return row
}

/**
 * Update mutable fields on a role. System roles can still be renamed but
 * their slug must remain stable in practice (we don't enforce that here —
 * left to admin discretion since slug uniqueness is enforced by the DB).
 */
export async function update(
  id: string,
  input: UpdateRoleInput,
  actorId: string | null,
): Promise<RoleRow> {
  const before = await getById(id)

  const patch: Partial<typeof roles.$inferInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.slug !== undefined) patch.slug = input.slug
  if (input.nameId !== undefined) patch.nameId = input.nameId
  if (input.nameAr !== undefined) patch.nameAr = input.nameAr
  if (input.description !== undefined) patch.description = input.description

  // Guard against slug collision with another active role.
  if (input.slug !== undefined && input.slug !== before.slug) {
    const collision = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.slug, input.slug), isNull(roles.deletedAt)))
      .limit(1)
    if (collision.length > 0) {
      throw new ApiError('CONFLICT', `Slug "${input.slug}" sudah dipakai`)
    }
  }

  const [row] = await db
    .update(roles)
    .set(patch)
    .where(eq(roles.id, id))
    .returning()

  if (!row) {
    throw new ApiError('NOT_FOUND', 'Role tidak ditemukan')
  }

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'role',
    resourceId: id,
    diff: {
      ...(input.slug !== undefined && input.slug !== before.slug
        ? { slug: [before.slug, row.slug] }
        : {}),
      ...(input.nameId !== undefined && input.nameId !== before.nameId
        ? { nameId: [before.nameId, row.nameId] }
        : {}),
      ...(input.nameAr !== undefined && input.nameAr !== before.nameAr
        ? { nameAr: [before.nameAr, row.nameAr] }
        : {}),
      ...(input.description !== undefined && input.description !== before.description
        ? { description: [before.description, row.description] }
        : {}),
    },
  })

  return row
}

/**
 * Soft-delete a role. Refuses with `CONFLICT` for system roles
 * (admin/reviewer/subscriber). Invalidates the permission cache for every
 * user that had this role.
 */
export async function softDelete(id: string, actorId: string | null): Promise<void> {
  const role = await getById(id)
  if (role.isSystem) {
    throw new ApiError('CONFLICT', 'Role sistem tidak bisa dihapus')
  }

  // Collect affected users *before* the delete cascades so we can invalidate
  // their permission cache.
  const affected = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, id))

  await db
    .update(roles)
    .set({
      deletedAt: new Date(),
      deletedBy: actorId ?? null,
      updatedAt: new Date(),
      updatedBy: actorId ?? null,
    })
    .where(eq(roles.id, id))

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'role',
    resourceId: id,
    diff: { slug: [role.slug, null] },
  })

  // Invalidate effective-permission cache for all affected users.
  await Promise.all(
    affected.map((r) => invalidatePermissions(r.userId).catch(() => undefined)),
  )
}

/**
 * Replace the full permission set for a role. Runs `delete + insert` in a
 * single `db.batch` (Neon HTTP doesn't support `db.transaction`) so the
 * matrix is never observed half-applied. Invalidates permission cache for
 * every user holding this role.
 */
export async function setPermissions(
  roleId: string,
  permissionIds: string[],
  actorId: string | null,
): Promise<void> {
  // Ensure role exists & not soft-deleted.
  await getById(roleId)

  // De-dupe input to avoid PK violation on the composite (roleId, permissionId).
  const uniqueIds = Array.from(new Set(permissionIds))

  // Neon HTTP driver doesn't support `db.transaction`. We model the same
  // "delete + insert" atomically with `db.batch` (Neon ships these as a
  // single multi-statement request). If `uniqueIds` is empty we still need
  // the delete, so issue it on its own.
  if (uniqueIds.length > 0) {
    await db.batch([
      db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId)),
      db.insert(rolePermissions).values(
        uniqueIds.map((permissionId) => ({
          roleId,
          permissionId,
          grantedBy: actorId ?? null,
        })),
      ),
    ])
  } else {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
  }

  await auditLog.write({
    actorId,
    action: 'permission_change',
    resourceType: 'role',
    resourceId: roleId,
    diff: { permissionIds: [null, uniqueIds] },
  })

  // Invalidate cache for every user assigned to this role.
  const affected = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId))

  await Promise.all(
    affected.map((r) => invalidatePermissions(r.userId).catch(() => undefined)),
  )
}

/**
 * Resolve role ids from slugs (used by user-invite flow). Skips missing slugs.
 */
export async function getIdsBySlugs(slugs: string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map()
  const rows = await db
    .select({ id: roles.id, slug: roles.slug })
    .from(roles)
    .where(and(inArray(roles.slug, slugs), isNull(roles.deletedAt)))
  return new Map(rows.map((r) => [r.slug, r.id]))
}
