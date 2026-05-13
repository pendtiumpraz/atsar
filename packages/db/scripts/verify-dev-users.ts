// Verify that dev users have correct better-auth account mapping
// (accountId must equal user.id, not email). Delete after verification.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  const rows = await sql`
    SELECT u.email, u.id AS user_id, a.account_id, a.provider_id,
           length(a.password) AS pw_len
    FROM users u
    JOIN accounts a ON a.user_id = u.id
    WHERE u.email LIKE '%@atsar.local'
    ORDER BY u.email
  `
  console.table(rows)
  for (const r of rows) {
    const ok = r.account_id === r.user_id && r.provider_id === 'credential' && r.pw_len === 60
    console.log(`${ok ? '✓' : '✗'} ${r.email}  match=${ok}`)
  }
  await sql.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
