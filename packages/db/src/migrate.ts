// Apply Drizzle migrations.
// Usage: pnpm db:migrate

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL not set')

  const sql = neon(url)
  const db = drizzle(sql)

  const migrationsFolder = path.resolve(__dirname, '..', 'drizzle')
  console.log('Applying migrations from', migrationsFolder)

  await migrate(db, { migrationsFolder })
  console.log('✓ Migrations applied')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
