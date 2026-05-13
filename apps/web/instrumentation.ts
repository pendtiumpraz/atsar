// Next.js instrumentation hook — runs once at server start.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// We use it to:
//  - Initialize Sentry (if `@sentry/nextjs` is installed and SENTRY_DSN set).
//  - Emit a "server starting" structured log line.

export async function register(): Promise<void> {
  // Skip on Edge runtime — Sentry/Pino are configured for Node only.
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return

  // Use dynamic imports so this file stays cheap to evaluate on cold start
  // and doesn't pull server-only deps into the Edge bundle.
  const [{ logger }, { initSentry }] = await Promise.all([
    import('./lib/server/logger'),
    import('./lib/server/sentry'),
  ])

  await initSentry()

  logger.info(
    {
      nodeEnv: process.env['NODE_ENV'],
      vercelEnv: process.env['VERCEL_ENV'],
      region: process.env['VERCEL_REGION'],
    },
    'server starting',
  )
}
