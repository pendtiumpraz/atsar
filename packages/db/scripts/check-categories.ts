import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')
const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const cats = await sql`SELECT slug, name_id FROM figure_categories WHERE deleted_at IS NULL ORDER BY name_id`
  console.log('=== figure_categories ===')
  console.table(cats)

  const counts = await sql`
    SELECT c.slug AS category, f.gender, COUNT(*) AS n
    FROM figures f
    JOIN figure_categories c ON c.id = f.category_id
    WHERE f.deleted_at IS NULL
    GROUP BY c.slug, f.gender
    ORDER BY c.slug, f.gender
  `
  console.log('=== figures by category × gender ===')
  console.table(counts)
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
