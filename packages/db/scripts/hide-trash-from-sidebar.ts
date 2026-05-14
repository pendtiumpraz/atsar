// One-shot: deactivate the sidebar entries for "Sampah" — the trash UI now
// lives as a pill inside the figures category tabs (admin-only). Keep the
// menu_items rows for traceability, just flip is_active=false.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')
const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const slugs = ['admin-trash', 'admin-trash-figures', 'admin-trash-battles']
  const r = await sql`UPDATE menu_items SET is_active = false WHERE slug = ANY(${slugs}) AND deleted_at IS NULL RETURNING slug`
  console.log('Deactivated:', r.map((row) => row.slug))
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
