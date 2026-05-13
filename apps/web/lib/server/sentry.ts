// Sentry stub — lazy-loads `@sentry/nextjs` IF installed, otherwise falls
// back to logging via pino. This keeps the module import-safe regardless of
// whether Sentry is wired up yet (it will be installed later).
//
// Usage:
// ```ts
// import { captureException, initSentry } from '@/lib/server/sentry'
// captureException(err, { route: '/api/foo', userId })
// ```

import { logger } from './logger.js'

/** Minimal shape we use from `@sentry/nextjs`. */
type SentryLike = {
  init?: (opts: Record<string, unknown>) => void
  captureException?: (err: unknown, ctx?: unknown) => void
  setUser?: (user: Record<string, unknown> | null) => void
}

let sentry: SentryLike | null = null
let loaded = false
let loading: Promise<void> | null = null

/**
 * Attempt to lazy-import `@sentry/nextjs`. Resolves with `null` if the
 * package is not installed or fails to load. Memoized after first call.
 */
async function loadSentry(): Promise<SentryLike | null> {
  if (loaded) return sentry
  if (loading) {
    await loading
    return sentry
  }
  loading = (async () => {
    try {
      // Dynamic import via a non-literal specifier so TypeScript does not
      // attempt to resolve `@sentry/nextjs` at compile time (the package is
      // optional and may not be installed). Webpack also skips tracing
      // computed-string imports.
      const specifier = '@sentry/nextjs'
      const mod: unknown = await (
        Function('s', 'return import(s)') as (s: string) => Promise<unknown>
      )(specifier).catch(() => null)
      if (mod && typeof mod === 'object') {
        sentry = mod as SentryLike
      }
    } catch {
      // Swallow — Sentry is optional.
      sentry = null
    } finally {
      loaded = true
    }
  })()
  await loading
  return sentry
}

/**
 * Initialize Sentry if the package is present and `SENTRY_DSN` is set.
 * Safe to call multiple times; safe to call when Sentry is not installed.
 * Intended to be invoked from `instrumentation.ts#register`.
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env['SENTRY_DSN']
  if (!dsn) return
  const s = await loadSentry()
  if (!s?.init) return
  try {
    s.init({
      dsn,
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: Number(
        process.env['SENTRY_TRACES_SAMPLE_RATE'] ?? '0.1',
      ),
    })
    logger.info('[sentry] initialized')
  } catch (err) {
    logger.warn({ err }, '[sentry] init failed')
  }
}

/**
 * Report an exception. Uses Sentry if available; otherwise logs the error
 * via pino so it still reaches the log aggregator.
 */
export function captureException(
  err: unknown,
  ctx?: Record<string, unknown>,
): void {
  // Fire-and-forget: never block the caller on the dynamic import.
  void (async () => {
    const s = await loadSentry()
    if (s?.captureException) {
      try {
        s.captureException(err, ctx ? { extra: ctx } : undefined)
        return
      } catch {
        // Fall through to pino fallback.
      }
    }
    logger.error({ err, ...(ctx ?? {}) }, 'captured exception')
  })()
}
