// Drizzle client — Neon serverless driver.
// Lazily initializes so that build-time module evaluation doesn't throw
// when DATABASE_URL isn't loaded (e.g. `next build` from apps/web without
// a local .env.local present in apps/web). Real Vercel deploys have env
// vars injected at runtime.

import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema/index.js'

type Drizzle = NeonHttpDatabase<typeof schema>

let _db: Drizzle | null = null

function getDb(): Drizzle {
  if (_db) return _db
  const url = process.env['DATABASE_URL']
  if (!url) throw new Error('DATABASE_URL is not set')
  neonConfig.fetchConnectionCache = true
  const sql = neon(url)
  _db = drizzle(sql, { schema })
  return _db
}

/**
 * Proxy that defers the real client creation until the first property
 * access. Lets modules `import { db } from '@athar/db'` at top-level
 * without forcing DATABASE_URL to be present at import time.
 */
export const db = new Proxy({} as Drizzle, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const value = real[prop]
    if (typeof value === 'function') return (value as Function).bind(real)
    return value
  },
}) as Drizzle

export type DB = Drizzle
export { schema }
