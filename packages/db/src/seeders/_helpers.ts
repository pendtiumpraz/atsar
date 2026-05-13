// Shared helpers for seeders.

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../schema/index.js'

export type SeedDb = ReturnType<typeof drizzle<typeof schema>>

let _db: SeedDb | null = null
let _client: postgres.Sql | null = null

export function getSeedDb(): SeedDb {
  if (_db) return _db
  const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL not set')
  _client = postgres(url, { max: 5, prepare: false })
  _db = drizzle(_client, { schema })
  return _db
}

export async function closeSeedDb(): Promise<void> {
  if (_client) {
    await _client.end()
    _client = null
    _db = null
  }
}

export function logSeed(name: string, count: number, action = 'seeded'): void {
  console.log(`  ✓ ${name}: ${count} ${action}`)
}
