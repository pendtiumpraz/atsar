import { loadEnvFromMonorepoRoot } from '@athar/shared/env'
loadEnvFromMonorepoRoot()

import { defineConfig } from 'drizzle-kit'

const databaseUrl = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']

if (!databaseUrl) {
  throw new Error('DATABASE_URL (or DATABASE_URL_UNPOOLED) is required in env')
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
})
