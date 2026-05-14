import 'dotenv/config'
import postgres from 'postgres'
const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')
const sql = postgres(url, { max: 1, prepare: false })
async function main() {
  const r = await sql`SELECT unnest(enum_range(NULL::research_job_type_enum)) AS val`
  console.log('research_job_type_enum:', r.map((x) => x.val))
  const r2 = await sql`SELECT slug FROM ai_providers WHERE deleted_at IS NULL ORDER BY priority DESC NULLS LAST LIMIT 5`
  console.log('providers:', r2.map((x) => x.slug))
  // Test if enum has figure_reingest by attempting a dry select
  try {
    const r3 = await sql`SELECT 'figure_reingest'::research_job_type_enum AS val`
    console.log('figure_reingest cast OK:', r3[0])
  } catch (e) {
    console.log('figure_reingest cast FAILED:', (e as Error).message)
  }
  await sql.end()
}
main().catch((e) => { console.error(e); process.exit(1) })
