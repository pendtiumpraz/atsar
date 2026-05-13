// POST /api/v1/admin/doc-analyze
//
// Admin entry-point for the doc analyzer pipeline. Accepts either an inline
// `text` payload (paste-into-textbox flow) or an `uploadKey` referring to a
// previously-uploaded file (PDF/DOCX). The actual LLM extraction + DB merge
// runs asynchronously via QStash so we don't tie up a request thread for the
// 30–60s an analysis can take.
//
// Permission: `ai.doc_analyzer.use`. See IDEAS.md §5.

import { z } from 'zod'

import { ApiError, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { publishJob } from '@/lib/server/qstash'
import { auditLog } from '@/lib/server/services/audit.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const bodySchema = z
  .object({
    /** Inline text — use this for paste-input or short snippets. */
    text: z.string().min(1).max(200_000).optional(),
    /** Storage key from `POST /api/v1/uploads` (purpose=doc_analyzer). */
    uploadKey: z.string().min(1).max(500).optional(),
    /** Optional context: which figure category this doc primarily covers. */
    categoryHint: z.string().min(1).max(120).optional(),
  })
  .refine((v) => Boolean(v.text ?? v.uploadKey), {
    message: 'Provide either `text` or `uploadKey`',
    path: ['text'],
  })

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requirePermission(req, 'ai.doc_analyzer.use')
  const body = await validateBody(req, bodySchema)

  // Defence-in-depth: uploadKey must look like `doc_analyzer/<userId>/<uuid>`
  // so an admin can't smuggle a key belonging to a different purpose.
  if (body.uploadKey && !body.uploadKey.startsWith('doc_analyzer/')) {
    throw new ApiError(
      'VALIDATION_ERROR',
      'uploadKey must reference a doc_analyzer upload',
    )
  }

  // Publish to the QStash worker. Dedup on the upload key (when present) so
  // accidental double-submits don't re-charge the LLM.
  const payload = {
    text: body.text ?? null,
    uploadKey: body.uploadKey ?? null,
    categoryHint: body.categoryHint ?? null,
    requestedBy: userId,
    requestedAt: new Date().toISOString(),
  }

  const { messageId } = await publishJob('doc-analyze', payload, {
    deduplicationId: body.uploadKey
      ? `doc-analyze:${body.uploadKey}`
      : undefined,
  }).catch((err: unknown) => {
    throw new ApiError(
      'EXTERNAL_AI_ERROR',
      'Failed to publish doc-analyze job',
      { cause: err },
    )
  })

  await auditLog.write({
    actorId: userId,
    actorRole: 'admin',
    action: 'config_change',
    resourceType: 'doc_analyze_job',
    resourceId: messageId,
    diff: {
      uploadKey: body.uploadKey,
      hasInlineText: Boolean(body.text),
      textBytes: body.text ? body.text.length : 0,
      categoryHint: body.categoryHint ?? null,
    },
  })

  return ok({ jobId: messageId, status: 'queued' as const })
})
