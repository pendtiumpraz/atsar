// POST /api/v1/admin/research
// Admin triggers a batch of Deep Research crawls — one QStash job per
// figure name, staggered 10s apart to ease pressure on the LLM agent and
// on per-domain rate limits.
//
// Permission: `ai.agent.use` (see packages/db/src/seeders/002_permissions.ts).
// See docs/BACKEND.md §8.2 and docs/IDEAS.md §4.

import { z } from 'zod'

import { created, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { logger } from '@/lib/server/logger'

const STAGGER_SEC = 10
const MAX_BATCH = 50

const startResearchSchema = z.object({
  figureNames: z.array(z.string().trim().min(2).max(160)).min(1).max(MAX_BATCH),
  categorySlug: z.string().trim().min(1).max(64),
})

export const POST = withErrorHandling(async (req) => {
  await requirePermission(req, 'ai.agent.use')
  const input = await validateBody(req, startResearchSchema)
  const log = logger.child({ route: '/api/v1/admin/research' })

  // De-duplicate names (case-insensitive) so a sloppy paste doesn't trigger
  // multiple jobs for the same figure.
  const seen = new Set<string>()
  const unique = input.figureNames.filter((n) => {
    const k = n.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  const enqueued: { figureName: string; messageId: string; delaySec: number }[] = []
  const failed: { figureName: string; error: string }[] = []

  for (const [index, figureName] of unique.entries()) {
    const delaySec = index * STAGGER_SEC
    try {
      const { messageId } = await publishJob(
        'research',
        { figureName, categorySlug: input.categorySlug },
        {
          delaySec,
          // Idempotency: if admin clicks the button twice within QStash's
          // retention window, the second publish is a no-op.
          deduplicationId: `research-${input.categorySlug}-${figureName.toLowerCase()}`,
        },
      )
      enqueued.push({ figureName, messageId, delaySec })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.error({ figureName, err: message }, 'failed to publish research job')
      failed.push({ figureName, error: message })
    }
  }

  return created({
    enqueued,
    failed,
    totals: { requested: unique.length, enqueued: enqueued.length, failed: failed.length },
  })
})
