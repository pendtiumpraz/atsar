// Menu service — fetch the menu tree and the role↔menu access matrix.
// See docs/BACKEND.md §5 (RBAC: menu.manage permission gates this).
//
// The matrix replacement runs in a single transaction; audit log records
// the change. Frontend renders the tree and lets admins toggle visibility
// per role.

import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { menuItems, roleMenuAccess } from '@athar/db/schema'

import { auditLog } from './audit.service.js'

/** Raw row from `menu_items`. */
export type MenuItemRow = typeof menuItems.$inferSelect

/** Tree node — same as the row plus a `children` array. */
export interface MenuTreeNode extends MenuItemRow {
  children: MenuTreeNode[]
}

/**
 * List active, non-deleted menu items as a parent/child tree.
 *
 * Ordering: each level is sorted by `displayOrder ASC`, then `slug ASC` as
 * a deterministic tiebreaker.
 */
export async function listTree(): Promise<MenuTreeNode[]> {
  const rows = await db
    .select()
    .from(menuItems)
    .where(and(isNull(menuItems.deletedAt), eq(menuItems.isActive, true)))
    .orderBy(asc(menuItems.displayOrder), asc(menuItems.slug))

  // Index every row by id, attach a fresh `children` array on each.
  const byId = new Map<string, MenuTreeNode>()
  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] })
  }

  // Wire up parents → children. Rows whose parent was filtered out (e.g.
  // a deactivated parent) are promoted to the top level — better than
  // silently dropping them.
  const roots: MenuTreeNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

/**
 * Return the set of menu item ids that are visible to `roleId`.
 *
 * Only rows with `can_view = true` are returned. The result is a `Set`
 * so callers can do O(1) membership checks while painting the UI matrix.
 */
export async function getRoleAccess(roleId: string): Promise<Set<string>> {
  const rows = await db
    .select({ menuItemId: roleMenuAccess.menuItemId })
    .from(roleMenuAccess)
    .where(and(eq(roleMenuAccess.roleId, roleId), eq(roleMenuAccess.canView, true)))
  return new Set(rows.map((r) => r.menuItemId))
}

/**
 * Replace the full menu-access matrix for one role. Wipes and re-inserts
 * the rows for that role inside a transaction so the visible-menu list
 * is never observed half-applied during a save.
 */
export async function setRoleAccess(
  roleId: string,
  menuIds: string[],
  actorId: string | null,
): Promise<void> {
  const uniqueIds = Array.from(new Set(menuIds))

  await db.transaction(async (tx) => {
    await tx.delete(roleMenuAccess).where(eq(roleMenuAccess.roleId, roleId))
    if (uniqueIds.length > 0) {
      await tx.insert(roleMenuAccess).values(
        uniqueIds.map((menuItemId) => ({
          roleId,
          menuItemId,
          canView: true,
        })),
      )
    }
  })

  await auditLog.write({
    actorId,
    action: 'config_change',
    resourceType: 'role_menu_access',
    resourceId: roleId,
    diff: { menuIds: [null, uniqueIds] },
  })
}
