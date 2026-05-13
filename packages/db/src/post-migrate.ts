// Post-migration ALTERs that Drizzle Kit can't generate:
// - PostGIS GEOGRAPHY column type
// - GIST index for spatial queries
// - GIN indexes for array filtering on figures
// - Materialized view for ai_usage_monthly_summary
//
// Idempotent: safe to run multiple times.
// Usage: pnpm --filter @athar/db exec tsx src/post-migrate.ts

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import postgres from 'postgres'

async function main() {
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL not set')

  const sql = postgres(url, { max: 1, prepare: false })

  console.log('Running post-migrate steps...')

  // ─── locations.coordinates → geography ─────────────────────────────
  try {
    // Cast existing text values (if any) to geography. Otherwise just alter type.
    await sql.unsafe(`
      ALTER TABLE locations
      ALTER COLUMN coordinates TYPE geography(point, 4326)
      USING coordinates::geography(point, 4326)
    `)
    console.log('✓ locations.coordinates → geography(point, 4326)')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('already') || msg.includes('does not exist')) {
      console.log('  (skipped: already altered or no rows yet)')
    } else {
      console.warn('  geography alter:', msg)
    }
  }

  // ─── GIST index for spatial queries ────────────────────────────────
  try {
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS locations_coordinates_gist_idx
       ON locations USING GIST (coordinates)`,
    )
    console.log('✓ locations_coordinates_gist_idx')
  } catch (e: unknown) {
    console.warn('  gist index:', e instanceof Error ? e.message : String(e))
  }

  // ─── GIN indexes for array filtering on figures ────────────────────
  const ginIndexes = [
    {
      name: 'figures_specialty_gin_idx',
      sql: 'CREATE INDEX IF NOT EXISTS figures_specialty_gin_idx ON figures USING GIN (specialty)',
    },
    {
      name: 'figures_social_category_gin_idx',
      sql: 'CREATE INDEX IF NOT EXISTS figures_social_category_gin_idx ON figures USING GIN (social_category)',
    },
  ]
  for (const idx of ginIndexes) {
    try {
      await sql.unsafe(idx.sql)
      console.log(`✓ ${idx.name}`)
    } catch (e: unknown) {
      console.warn(`  ${idx.name}:`, e instanceof Error ? e.message : String(e))
    }
  }

  // ─── FTS indexes (bilingual) ───────────────────────────────────────
  const ftsIndexes = [
    {
      name: 'figures_fts_id_idx',
      sql: `CREATE INDEX IF NOT EXISTS figures_fts_id_idx ON figures
            USING GIN (to_tsvector('simple', coalesce(name_full_id,'') || ' ' || coalesce(summary_id,'')))`,
    },
    {
      name: 'figures_fts_ar_idx',
      sql: `CREATE INDEX IF NOT EXISTS figures_fts_ar_idx ON figures
            USING GIN (to_tsvector('simple', coalesce(name_full_ar,'') || ' ' || coalesce(summary_ar,'')))`,
    },
  ]
  for (const idx of ftsIndexes) {
    try {
      await sql.unsafe(idx.sql)
      console.log(`✓ ${idx.name}`)
    } catch (e: unknown) {
      console.warn(`  ${idx.name}:`, e instanceof Error ? e.message : String(e))
    }
  }

  // ─── pgvector HNSW index on citation embeddings ────────────────────
  try {
    await sql.unsafe(
      `CREATE INDEX IF NOT EXISTS cce_embedding_hnsw_idx
       ON content_citation_embeddings USING hnsw (embedding vector_cosine_ops)`,
    )
    console.log('✓ cce_embedding_hnsw_idx (pgvector)')
  } catch (e: unknown) {
    console.warn('  hnsw index:', e instanceof Error ? e.message : String(e))
  }

  // ─── auto-update updated_at trigger ────────────────────────────────
  try {
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)
    console.log('✓ touch_updated_at() function')

    // Attach trigger to all tables with updated_at column.
    const tables = (await sql.unsafe(`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'updated_at'
    `)) as Array<{ table_name: string }>

    for (const { table_name } of tables) {
      try {
        await sql.unsafe(`DROP TRIGGER IF EXISTS touch_updated_at ON "${table_name}"`)
        await sql.unsafe(
          `CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "${table_name}"
           FOR EACH ROW EXECUTE FUNCTION touch_updated_at()`,
        )
      } catch (e) {
        // ignore — table might lack updated_at or be system
      }
    }
    console.log(`✓ touch_updated_at trigger attached to ${tables.length} tables`)
  } catch (e: unknown) {
    console.warn('  trigger:', e instanceof Error ? e.message : String(e))
  }

  // ─── Materialized view: ai_usage_monthly_summary ──────────────────
  // Spec: docs/DATABASE.md §8.6. Refreshed hourly via QStash
  // (`/api/jobs/cron/refresh-mv`). The unique index is required so we can
  // use `REFRESH MATERIALIZED VIEW CONCURRENTLY` and avoid blocking reads.
  try {
    await sql.unsafe(`
      CREATE MATERIALIZED VIEW IF NOT EXISTS ai_usage_monthly_summary AS
      SELECT
        user_id,
        date_trunc('month', created_at) AS period,
        role,
        SUM(credits_used) AS total_credits,
        SUM(input_tokens) AS total_input,
        SUM(output_tokens) AS total_output,
        COUNT(*) AS total_calls
      FROM ai_usage_logs
      GROUP BY user_id, period, role
    `)
    await sql.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_monthly_summary_pk
        ON ai_usage_monthly_summary (user_id, period, role)
    `)
    console.log('✓ ai_usage_monthly_summary materialized view')
  } catch (e) {
    console.warn('  mv:', e instanceof Error ? e.message : String(e))
  }

  await sql.end()
  console.log('\nPost-migrate complete.')
}

main().catch((err) => {
  console.error('Post-migrate failed:', err)
  process.exit(1)
})
