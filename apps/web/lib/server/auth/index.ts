// Barrel for the server-side auth module.
//
// Import from `@/lib/server/auth` rather than reaching into individual
// files — keeps the wiring details (better-auth + drizzle adapter) an
// implementation concern.

export { auth } from './instance.js'
export type { Auth, Session } from './instance.js'

export { authConfig } from './config.js'
export type { AuthConfig } from './config.js'
