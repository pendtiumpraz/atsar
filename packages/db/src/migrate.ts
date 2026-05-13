// Apply Drizzle migrations using postgres-js (TCP direct).
// neon-http migrator has retry issues — use postgres-js for reliable migration.
// Usage: pnpm db:migrate

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL not set')

  // Single connection for migrations (no pooling).
  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client)

  const migrationsFolder = path.resolve(__dirname, '..', 'drizzle')
  console.log('Applying migrations from', migrationsFolder)

  try {
    await migrate(db, { migrationsFolder })
    console.log('✓ Migrations applied')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
