// Sub-job: compute citation embeddings for downstream RAG.
//
// Producer: `apps/web/app/api/jobs/research/route.ts` enqueues this with a
// list of newly-inserted citation ids after a Deep Research run.
//
// Status: STUB.
//
// TODO(v2):
// - Resolve the active `embedding` model via `getActiveModel('embedding')`
//   and build a `getEmbeddingModelInstance(active)` (the current registry
//   only exposes language models; we need an embeddings counterpart).
// - For each citation: pick a text source (prefer `sourceExcerptId`,
//   fall back to `sourceExcerptAr`), call `embed`/`embedMany` from the
//   Vercel AI SDK, and INSERT into `content_citation_embeddings` (pgvector
//   1536-dim — see DATABASE.md §7.4).
// - Batch in chunks of 16-32 to amortise model cost.
// - On embedding-API failure, return non-2xx so QStash retries.

import { z } from 'zod'
import { withSignature } from '../../_lib/with-signature.js'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const ExtractPayload = z.object({
  citationIds: z.array(z.string().uuid()).min(1).max(200),
})

export const POST = withSignature(async (req) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON' } },
      { status: 422 },
    )
  }

  const parsed = ExtractPayload.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'invalid extract payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  // TODO: real embedding work — see file header.
  console.info('[jobs/research/extract] (stub) would embed citations', {
    count: parsed.data.citationIds.length,
  })

  return Response.json({
    ok: true,
    stub: true,
    citationIds: parsed.data.citationIds,
    note: 'embedding pipeline not yet wired — see TODO in this file',
  })
})
