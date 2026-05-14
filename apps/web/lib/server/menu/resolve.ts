// Server-side menu resolution — same query as GET /api/v1/me/menu, but
// callable from server components so the sidebar can paint with the
// correct items on first render (no client refetch flicker).
//
// Returns rows ordered by display_order, de-duped across roles.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'
import { db } from '@athar/db'
import { menuItems, roleMenuAccess, roles } from '@athar/db/schema'

export interface ResolvedMenuItem {
  id: string
  slug: string
  labelId: string
  labelAr: string | null
  path: string | null
  icon: string | null
  parentId: string | null
  displayOrder: number
}

export async function resolveMenuForUser(userId: string): Promise<ResolvedMenuItem[]> {
  const roleSlugs = await getUserRoleSlugs(userId)
  if (roleSlugs.size === 0) return []

  const roleRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(inArray(roles.slug, Array.from(roleSlugs)), isNull(roles.deletedAt)))

  const roleIds = roleRows.map((r) => r.id)
  if (roleIds.length === 0) return []

  const rows = await db
    .select({
      id: menuItems.id,
      slug: menuItems.slug,
      labelId: menuItems.labelId,
      labelAr: menuItems.labelAr,
      path: menuItems.path,
      icon: menuItems.icon,
      parentId: menuItems.parentId,
      displayOrder: menuItems.displayOrder,
    })
    .from(menuItems)
    .innerJoin(roleMenuAccess, eq(roleMenuAccess.menuItemId, menuItems.id))
    .where(
      and(
        inArray(roleMenuAccess.roleId, roleIds),
        eq(roleMenuAccess.canView, true),
        eq(menuItems.isActive, true),
        isNull(menuItems.deletedAt),
      ),
    )
    .orderBy(asc(menuItems.displayOrder))

  const seen = new Set<string>()
  const items: ResolvedMenuItem[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    items.push(row)
  }
  return items
}
