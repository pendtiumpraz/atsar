// Apply hand-written migration SQL files that drizzle-kit's journal doesn't
// know about (because they were written manually outside the generate flow).
// Reads 0003..0099 *.sql from drizzle/ and runs each statement; idempotent
// because every statement uses IF NOT EXISTS / ALTER TYPE ADD VALUE IF NOT
// EXISTS / etc.
import 'dotenv/config'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')

const DRIZZLE_DIR = path.resolve(import.meta.dirname, '..', 'drizzle')

async function main() {
  const files = (await readdir(DRIZZLE_DIR))
    .filter((f) => /^00(0[3-9]|[1-9]\d)_.*\.sql$/.test(f))
    .sort()
  if (files.length === 0) {
    console.log('No pending hand-written migrations found.')
    return
  }
  const sql = postgres(url, { max: 1, prepare: false })
  for (const file of files) {
    const fullPath = path.join(DRIZZLE_DIR, file)
    const content = await readFile(fullPath, 'utf8')
    // Run the entire file as a single multi-statement query so CREATE +
    // ALTER + CREATE INDEX share one transaction (the FK target table
    // must exist when the ALTER fires). The `--> statement-breakpoint`
    // marker is just a comment to Postgres; it does NOT need to be
    // split. Replace it with a no-op so the file is valid SQL as-is.
    const cleaned = content.replace(/-->\s*statement-breakpoint/g, '')
    try {
      await sql.unsafe(cleaned)
      console.log(`  ✓ ${file} applied`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/already exists|duplicate|exists, skipping/i.test(msg)) {
        console.log(`  ℹ ${file}: ${msg.slice(0, 100)}`)
      } else {
        console.error(`  ✗ FAILED in ${file}: ${msg.slice(0, 300)}`)
        throw e
      }
    }
  }
  await sql.end()
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
