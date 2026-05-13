// Atsar worker entry — boots BullMQ workers.
// Full job implementations land in Phase 2.8 + 3.

import 'dotenv/config'
import pino from 'pino'

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  base: { service: 'athar-worker' },
})

async function main() {
  logger.info('Atsar worker starting...')

  // TODO Phase 2.8: register BullMQ workers here.
  //   import { Worker } from 'bullmq'
  //   new Worker('mail', mailProcessor, { connection: redis })
  //   new Worker('research', researchProcessor, { connection: redis })
  //   ...

  logger.info('Atsar worker ready (skeleton). Waiting for Phase 2.8 jobs.')

  // Keep process alive for now.
  setInterval(() => {
    // Health beat — replace with real metrics later.
  }, 30_000)
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker crashed')
  process.exit(1)
})

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info({ signal }, 'Worker shutting down')
  process.exit(0)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
