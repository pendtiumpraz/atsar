import { getSeedDb, logSeed } from './_helpers.js'
import { roles, menuItems, roleMenuAccess } from '../schema/index.js'

// Default menu access matrix.
const MENU_MATRIX: Record<string, string[]> = {
  admin: ['*'], // admin sees all
  reviewer: [
    'dashboard',
    'figures',
    'figures-nabi',
    'figures-sahabat',
    'figures-shahabiyat',
    'figures-tabiin',
    'figures-tabiiyat',
    'figures-tabiut',
    'figures-tabiut-fem',
    'figures-shalih',
    'timeline',
    'timeline-ulama',
    'map',
    'battles',
    'reviewer-queue',
    'chat',
    'settings',
    'admin-audit',
  ],
  subscriber: [
    'dashboard',
    'figures',
    'figures-nabi',
    'figures-sahabat',
    'figures-shahabiyat',
    'figures-tabiin',
    'figures-tabiiyat',
    'figures-tabiut',
    'figures-tabiut-fem',
    'figures-shalih',
    'timeline',
    'timeline-ulama',
    'map',
    'battles',
    'quiz',
    'chat',
    'pdf-builder',
    'settings',
    'billing',
  ],
}

export async function seed005RoleMenuAccess() {
  const db = getSeedDb()
  const allMenus = await db.select().from(menuItems)
  const allRoles = await db.select().from(roles)

  let total = 0
  for (const role of allRoles) {
    const allowed = MENU_MATRIX[role.slug] ?? []
    const allAccess = allowed.includes('*')
    for (const menu of allMenus) {
      const canView = allAccess || allowed.includes(menu.slug)
      if (canView) {
        await db
          .insert(roleMenuAccess)
          .values({ roleId: role.id, menuItemId: menu.id, canView: true })
          .onConflictDoNothing()
        total++
      }
    }
  }
  logSeed('role_menu_access', total)
}
