// One-shot dev utility: deletes the 3 demo users so seed028 can re-create them
// with a corrected accountId mapping. Safe to delete after use.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url, { max: 1, prepare: false })

const emails = ['admin@atsar.local', 'reviewer@atsar.local', 'subscriber@atsar.local']

async function main() {
  const deleted = await sql`DELETE FROM users WHERE email = ANY(${emails}) RETURNING email`
  console.log('Deleted:', deleted.map((r) => r.email))
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
