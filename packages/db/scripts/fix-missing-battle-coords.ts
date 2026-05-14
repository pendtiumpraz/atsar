// One-shot: backfill missing battle.location_id for the 2 battles whose
// seeder rows omitted locationSlug (ghazwah-bani-mushtaliq, ghazwah-hunain).
// Inserts the Muraysi' location if missing, then UPDATEs the two battle
// rows. Safe to re-run — idempotent.
import 'dotenv/config'
import postgres from 'postgres'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL not set')

const sql = postgres(url, { max: 1, prepare: false })

async function main() {
  // 1. Ensure Muraysi' location exists.
  await sql`
    INSERT INTO locations (slug, name_ar, name_id, country_code, region, coordinates, description_id)
    VALUES (
      'muraysi',
      'المريسيع',
      'Muraisi''',
      'SA',
      'hijaz',
      ST_GeogFromText('SRID=4326;POINT(38.95 23.50)'),
      'Sumber air Bani Mushtaliq; lokasi Ghazwah Bani Mushtaliq 5 H.'
    )
    ON CONFLICT (slug) DO NOTHING
  `

  // 2. Resolve location ids.
  const locs = await sql`
    SELECT slug, id FROM locations WHERE slug IN ('muraysi', 'hunayn')
  `
  const bySlug = new Map(locs.map((r) => [r.slug, r.id]))

  const mappings: ReadonlyArray<{ battle: string; loc: 'muraysi' | 'hunayn' }> = [
    { battle: 'ghazwah-bani-mushtaliq', loc: 'muraysi' },
    { battle: 'ghazwah-hunain', loc: 'hunayn' },
  ]

  for (const m of mappings) {
    const locId = bySlug.get(m.loc)
    if (!locId) {
      console.warn(`  ✗ location ${m.loc} not found, skipping ${m.battle}`)
      continue
    }
    const result = await sql`
      UPDATE battles
         SET location_id = ${locId}
       WHERE slug = ${m.battle} AND location_id IS NULL
      RETURNING slug
    `
    console.log(`  ${result.length ? '✓' : 'ℹ'} ${m.battle} → ${m.loc} (${result.length ? 'updated' : 'already set'})`)
  }

  await sql.end()
}

main().catch((err) => { console.error(err); process.exit(1) })
