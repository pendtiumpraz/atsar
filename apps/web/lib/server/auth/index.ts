// Barrel for the server-side auth module.
//
// Import from `@/lib/server/auth` rather than reaching into individual
// files — keeps the wiring details (better-auth + drizzle adapter) an
// implementation concern.

export { auth } from './instance.js'
export type { Auth, Session } from './instance.js'

export { authConfig } from './config.js'
export type { AuthConfig } from './config.js'

export {
  requireActiveSubscription,
  getActiveSubscription,
} from './subscription-gate.js'
export type { ActiveSubscription } from './subscription-gate.js'

// `getMyRoleSlugs` is intentionally NOT re-exported here — it's a Server
// Action (`'use server'`) consumed directly by client components like
// LoginForm. Re-exporting through this barrel would pull the full auth
// instance + Drizzle DB into the client bundle. Import it from
// `@/lib/server/auth/get-role-slugs` directly instead.
