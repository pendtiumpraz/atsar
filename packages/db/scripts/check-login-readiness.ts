// Diagnose login readiness for the 3 dev users. Checks every column
// better-auth's credential sign-in path inspects.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const rows = await sql`
    SELECT
      u.email,
      u.id AS user_id,
      u.email_verified,
      u.deleted_at,
      u.full_name,
      a.account_id,
      a.provider_id,
      length(a.password) AS pw_len,
      substring(a.password, 1, 7) AS pw_prefix
    FROM users u
    LEFT JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
    WHERE u.email LIKE '%@atsar.local'
    ORDER BY u.email
  `
  console.table(rows)
  await sql.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
