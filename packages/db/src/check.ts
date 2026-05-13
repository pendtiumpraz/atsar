// Smoke test: verify DB connectivity.
// Usage: pnpm db:check

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { neon } from '@neondatabase/serverless'

async function main() {
  const url = process.env['DATABASE_URL']
  if (!url) {
    console.error('✗ DATABASE_URL missing in env')
    process.exit(1)
  }

  const sql = neon(url)

  try {
    const start = Date.now()
    const rows = await sql`SELECT version(), now() as ts`
    const ms = Date.now() - start
    console.log(`✓ Postgres reachable in ${ms}ms`)
    console.log('  Version:', rows[0]?.['version'])
    console.log('  Server time:', rows[0]?.['ts'])

    // Check required extensions.
    const exts = await sql`
      SELECT extname FROM pg_extension
      WHERE extname IN ('postgis', 'vector', 'pg_trgm', 'unaccent')
    `
    const found = exts.map((e) => e['extname'])
    const required = ['postgis', 'vector']
    const missing = required.filter((r) => !found.includes(r))
    console.log('  Extensions found:', found.join(', ') || '(none)')
    if (missing.length > 0) {
      console.warn('  ⚠ Missing extensions:', missing.join(', '))
      console.warn('  → Enable in Neon: SQL Editor → CREATE EXTENSION ...')
    } else {
      console.log('  ✓ Required extensions present (postgis, vector)')
    }
  } catch (err) {
    console.error('✗ Postgres connection failed:', err)
    process.exit(1)
  }
}

main()
