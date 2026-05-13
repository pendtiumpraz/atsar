// One-time: enable required Postgres extensions on Neon.
// Usage: pnpm --filter @athar/db exec tsx src/enable-extensions.ts

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL not set')

  const sql = neon(url)

  const extensions = ['vector', 'postgis', 'pg_trgm', 'unaccent', 'pgcrypto']

  for (const ext of extensions) {
    try {
      // Drizzle doesn't accept identifier params for CREATE EXTENSION, so use raw.
      // ext name is from a fixed allowlist above — safe.
      await sql(`CREATE EXTENSION IF NOT EXISTS ${ext}`)
      console.log(`✓ ${ext} enabled`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`✗ ${ext}:`, msg)
    }
  }

  const rows = (await sql(
    `SELECT extname FROM pg_extension ORDER BY extname`,
  )) as Array<{ extname: string }>
  console.log('\nInstalled extensions:', rows.map((r) => r.extname).join(', '))
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
