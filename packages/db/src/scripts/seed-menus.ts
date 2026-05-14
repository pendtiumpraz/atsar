// One-off helper: seed only menu_items + role_menu_access.
//
// Useful when new admin pages are added in app/(admin)/admin/* and only
// the menu seeders need to pick them up. The seeders themselves are
// already idempotent (onConflictDoNothing), so re-running is safe.
//
// Usage: pnpm --filter @athar/db exec tsx src/scripts/seed-menus.ts

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { closeSeedDb } from '../seeders/_helpers.js'
import { seed004MenuItems } from '../seeders/004_menu_items.js'
import { seed005RoleMenuAccess } from '../seeders/005_role_menu_access.js'

async function main() {
  console.log('\nSeeding menu_items + role_menu_access\n')
  try {
    await seed004MenuItems()
    await seed005RoleMenuAccess()
    console.log('\n✓ Menu seed complete.')
  } catch (err) {
    console.error('\n✗ Menu seed failed:', err)
    process.exitCode = 1
  } finally {
    await closeSeedDb()
  }
}

main()
