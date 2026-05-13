// Pino logger — structured JSON in production, pretty in development.
// See docs/BACKEND.md §13 (Logging).
//
// Output: stdout. In Vercel/Coolify this is captured and forwarded to the
// log aggregator (Loki). Required fields per request (added via child()):
// `requestId`, `userId`, `route`, `durationMs`.

import pino, { type Logger } from 'pino'

const isProd = process.env['NODE_ENV'] === 'production'

export const logger: Logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: {
    service: 'athar-web',
    env: process.env['NODE_ENV'] ?? 'development',
  },
  // Pretty-print in dev only. In production we keep raw JSON for log
  // aggregators (no transport — pino writes structured JSON to stdout).
  ...(!isProd && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
})

/**
 * Create a child logger with additional bindings (e.g. `requestId`, `userId`).
 *
 * ```ts
 * const log = child({ requestId, route: '/api/v1/foo' })
 * log.info({ durationMs }, 'request completed')
 * ```
 */
export function child(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings)
}
