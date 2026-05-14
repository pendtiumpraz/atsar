// GET /api/v1/me/menu — return the sidebar menu items the current user is
// allowed to see. Resolution flow:
//
//   1. Resolve session via better-auth. No session → 401 AUTH_REQUIRED.
//   2. Look up the user's role slugs (`admin`, `reviewer`, `subscriber`, …).
//   3. Find every `menu_items` row joined with `role_menu_access` where the
//      access row matches one of the user's roles, `can_view = true`,
//      `is_active = true`, and the menu item is not soft-deleted.
//   4. De-duplicate (a menu item granted to two of the user's roles must
//      only appear once) and order by `display_order`.
//
// Response shape: `ok([{ id, slug, labelId, labelAr, path, icon, parentId,
// displayOrder }])` — a flat array, NOT paginated. The sidebar consumer
// (`components/organisms/sidebar.tsx`) reads either `data` or the raw array.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { ApiError, ok, withErrorHandling } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'
import { db } from '@athar/db'
import { menuItems, roleMenuAccess, roles } from '@athar/db/schema'

export const GET = withErrorHandling(async (req) => {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    throw new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.')
  }

  const roleSlugs = await getUserRoleSlugs(userId)
  if (roleSlugs.size === 0) {
    // No roles → no menu. Return empty array; sidebar will fall back to
    // its built-in defaults but at least the call resolves cleanly.
    return ok([])
  }

  // Resolve role IDs for the slugs the user holds. Filter soft-deleted roles.
  const roleRows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(inArray(roles.slug, Array.from(roleSlugs)), isNull(roles.deletedAt)))

  const roleIds = roleRows.map((r) => r.id)
  if (roleIds.length === 0) {
    return ok([])
  }

  // Join menu_items × role_menu_access, then de-duplicate in JS (cheaper
  // than DISTINCT ON across a tiny result set and works portably).
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
  const items: typeof rows = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    items.push(row)
  }

  return ok(items)
})
