// Drop all tables and re-run migrations + seed. DEV ONLY.
// Usage: pnpm db:reset

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { neon } from '@neondatabase/serverless'

async function main() {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('✗ Refusing to reset DB in production')
    process.exit(1)
  }

  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL not set')

  const sql = neon(url)

  console.log('⚠ Dropping public schema...')
  await sql`DROP SCHEMA public CASCADE`
  await sql`CREATE SCHEMA public`
  console.log('✓ Schema dropped and recreated')
  console.log('  → Now run: pnpm db:migrate && pnpm db:seed:dev')
}

main().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
