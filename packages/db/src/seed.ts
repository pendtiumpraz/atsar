// Seed runner. Phase 1.2 wires up the 17 seeder files (DATABASE §17).
// Usage: pnpm db:seed         (production seeders only)
//        pnpm db:seed:dev     (+ demo data)

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

async function main() {
  const isDev = process.argv.includes('--dev')
  console.log(`Seeding (mode: ${isDev ? 'dev' : 'production'})...`)

  // TODO Phase 1.2: import and run each seeder in order.
  //   await runSeeder('001_roles')
  //   await runSeeder('002_permissions')
  //   ...
  //   if (isDev) await runSeeder('017_demo_figures')

  console.log('✓ Seed complete (skeleton — Phase 1.2 fills this in).')
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
