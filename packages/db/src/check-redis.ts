// Smoke test: Upstash Redis REST + QStash auth.
// Usage: pnpm --filter @athar/db exec tsx src/check-redis.ts

import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

async function main() {
  const restUrl = process.env['KV_REST_API_URL']
  const restToken = process.env['KV_REST_API_TOKEN']
  const qstashToken = process.env['QSTASH_TOKEN']

  if (!restUrl || !restToken) {
    console.error('✗ Upstash KV_REST_API_URL / KV_REST_API_TOKEN missing')
    process.exit(1)
  }

  const { Redis } = await import('@upstash/redis')

  const redis = new Redis({ url: restUrl, token: restToken })

  try {
    const pong = await redis.ping()
    console.log('✓ Upstash Redis ping:', pong)

    const key = 'athar:bootstrap:test'
    const val = new Date().toISOString()
    await redis.set(key, val, { ex: 60 })
    const got = await redis.get(key)
    console.log('✓ SET/GET ok:', got)
  } catch (e: unknown) {
    console.error('✗ Redis failed:', e instanceof Error ? e.message : e)
  }

  if (qstashToken) {
    try {
      const { Client } = await import('@upstash/qstash')
      const qstash = new Client({ token: qstashToken })
      const schedules = await qstash.schedules.list()
      console.log(`✓ QStash auth ok. Existing schedules: ${schedules.length}`)
    } catch (e: unknown) {
      console.error('✗ QStash failed:', e instanceof Error ? e.message : e)
    }
  } else {
    console.warn('⚠ QSTASH_TOKEN missing — skipping QStash check')
  }
}

main()
