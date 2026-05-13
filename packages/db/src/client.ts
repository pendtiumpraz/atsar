// Drizzle client — Neon serverless driver.
// In Edge/serverless: use neon-http. In long-running (worker): use neon (websocket).

import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema/index.js'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set')
}

// Cache fetch responses to reduce cold-start overhead.
neonConfig.fetchConnectionCache = true

const sql = neon(databaseUrl)
export const db = drizzle(sql, { schema })

export type DB = typeof db
export { schema }
