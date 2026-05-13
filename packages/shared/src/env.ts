// Env loader for monorepo scripts.
// Loads .env.local (overrides) then .env (defaults) from the monorepo root.
// Web app uses Next.js' built-in env loader, so this is for worker/scripts only.

import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

export function loadEnvFromMonorepoRoot(startDir?: string): string {
  const start =
    startDir ?? path.dirname(fileURLToPath(import.meta.url))
  let dir = start
  // Walk up until we find pnpm-workspace.yaml (= root).
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      config({ path: path.join(dir, '.env.local'), override: true, quiet: true })
      config({ path: path.join(dir, '.env'), override: false, quiet: true })
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('Cannot find monorepo root (no pnpm-workspace.yaml found)')
}
