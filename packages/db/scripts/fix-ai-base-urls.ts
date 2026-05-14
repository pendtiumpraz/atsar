// One-shot: backfill missing baseUrl for Anthropic + Google providers in
// the live DB. Seeder is idempotent via ON CONFLICT DO NOTHING so re-running
// seed:dev wouldn't touch existing rows.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')
const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const updates = [
    { slug: 'anthropic', baseUrl: 'https://api.anthropic.com' },
    { slug: 'google', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  ]
  for (const u of updates) {
    const r = await sql`UPDATE ai_providers SET base_url = ${u.baseUrl} WHERE slug = ${u.slug} AND base_url IS NULL RETURNING slug`
    console.log(`  ${r.length ? '✓' : 'ℹ'} ${u.slug}  →  ${u.baseUrl} ${r.length ? '(updated)' : '(already set / not found)'}`)
  }
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
