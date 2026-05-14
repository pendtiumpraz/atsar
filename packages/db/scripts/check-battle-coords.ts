// Check whether battles have linked locations with valid coordinates.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const rows = await sql`
    SELECT
      b.slug AS battle,
      b.name_id,
      b.location_id,
      l.slug AS loc_slug,
      l.name_id AS loc_name,
      l.coordinates::text AS coordinates
    FROM battles b
    LEFT JOIN locations l ON l.id = b.location_id
    WHERE b.deleted_at IS NULL
    ORDER BY b.event_date_ah NULLS LAST
  `
  console.table(rows)
  const missing = rows.filter((r) => !r.coordinates)
  console.log(`\n${missing.length}/${rows.length} battles MISSING coordinates`)
  await sql.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
