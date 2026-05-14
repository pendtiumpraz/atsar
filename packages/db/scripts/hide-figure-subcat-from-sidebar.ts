// One-shot: deactivate per-category figure entries in the sidebar. They now
// live as <FigureCategoryTabs> pills on /figures itself; duplicating them
// in the nav was noisy. Rows are kept (is_active=false) so a future admin
// can re-enable any single category as a shortcut from the menu admin UI.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')
const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const slugs = [
    'figures-nabi',
    'figures-sahabat',
    'figures-shahabiyat',
    'figures-tabiin',
    'figures-tabiiyat',
    'figures-tabiut',
    'figures-tabiut-fem',
    'figures-shalih',
  ]
  const r = await sql`
    UPDATE menu_items
       SET is_active = false
     WHERE slug = ANY(${slugs})
       AND deleted_at IS NULL
     RETURNING slug
  `
  console.log('Deactivated:', r.map((row) => row.slug))
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
