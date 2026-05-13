// Seed runner. Runs production seeders 001–016 by default.
// With --dev flag also runs 017_demo_figures.
// Usage: pnpm db:seed [--dev]

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { closeSeedDb } from './seeders/_helpers.js'
import { seed001Roles } from './seeders/001_roles.js'
import { seed002Permissions } from './seeders/002_permissions.js'
import { seed003RolePermissions } from './seeders/003_role_permissions.js'
import { seed004MenuItems } from './seeders/004_menu_items.js'
import { seed005RoleMenuAccess } from './seeders/005_role_menu_access.js'
import { seed006Tiers } from './seeders/006_tiers.js'
import { seed007FigureCategories } from './seeders/007_figure_categories.js'
import { seed008AiProviders } from './seeders/008_ai_providers.js'
import { seed009AiModels } from './seeders/009_ai_models.js'
import { seed010AiRoleAssignments } from './seeders/010_ai_role_assignments.js'
import { seed011Fonts } from './seeders/011_fonts.js'
import { seed012FontAssignments } from './seeders/012_font_assignments.js'
import { seed013WhitelistDomains } from './seeders/013_whitelist_domains.js'
import { seed014PdfTemplates } from './seeders/014_pdf_templates.js'
import { seed015LocationsCore } from './seeders/015_locations_core.js'
import { seed016AdminUser } from './seeders/016_admin_user.js'
import { seed017DemoFigures } from './seeders/017_demo_figures.js'

async function main() {
  const isDev = process.argv.includes('--dev')
  console.log(`\nSeeding (mode: ${isDev ? 'dev' : 'production'})\n`)

  try {
    await seed001Roles()
    await seed002Permissions()
    await seed003RolePermissions()
    await seed004MenuItems()
    await seed005RoleMenuAccess()
    await seed006Tiers()
    await seed007FigureCategories()
    await seed008AiProviders()
    await seed009AiModels()
    await seed010AiRoleAssignments()
    await seed011Fonts()
    await seed012FontAssignments()
    await seed013WhitelistDomains()
    await seed014PdfTemplates()
    await seed015LocationsCore()
    await seed016AdminUser()

    if (isDev) {
      await seed017DemoFigures()
    }

    console.log('\n✓ Seed complete.')
  } catch (err) {
    console.error('\n✗ Seed failed:', err)
    process.exitCode = 1
  } finally {
    await closeSeedDb()
  }
}

main()
