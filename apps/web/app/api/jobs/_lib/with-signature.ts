// `withSignature` — thin alias over `verifySignatureAppRouter` from the
// Upstash SDK. Wraps a `/api/jobs/*` handler so that requests without a
// valid QStash signature get rejected with 401 before any work happens.
//
// Usage:
// ```ts
// import { withSignature } from '../_lib/with-signature.js'
// export const POST = withSignature(async (req) => {
//   const body = await req.json()
//   // …do work…
//   return Response.json({ ok: true })
// })
// ```
//
// The SDK helper already returns a `Response` shaped for App Router and
// handles the body cloning so `req.json()` still works in the inner handler.

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs'

/**
 * Signature of an unwrapped job route handler. The route receives the raw
 * `Request` — Next.js' route context isn't passed because QStash jobs are
 * always POST to a fixed URL (no dynamic params).
 */
export type JobHandler = (req: Request) => Promise<Response> | Response

/**
 * Wrap a job handler with QStash HMAC verification.
 *
 * Behaviour:
 * - Reads `upstash-signature` header.
 * - Verifies against `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`.
 * - Returns 401 on invalid/missing signature (handled by the SDK).
 * - On success, calls the inner handler with the original `Request`.
 */
export function withSignature(handler: JobHandler) {
  // Lazy — only create the Receiver at request time so the build's
  // "Collecting page data" pass doesn't need QStash signing keys present.
  let wrapped: ((req: Request) => Promise<Response> | Response) | null = null
  return async (req: Request): Promise<Response> => {
    // Internal bypass for self-invocation when QStash publish fails (e.g.
    // quota exhausted, deduplicationId collision). The producer endpoint
    // (admin route) fires `fetch(/api/jobs/research, { X-Internal-Token })`
    // with INTERNAL_JOB_TOKEN secret so the worker runs without leaving
    // the cluster. Admin-only flow; tokens are required.
    const internalToken = req.headers.get('x-internal-token')
    const envToken =
      process.env['INTERNAL_JOB_TOKEN'] ??
      process.env['BETTER_AUTH_SECRET'] ??
      null
    if (internalToken && envToken && internalToken === envToken) {
      return handler(req)
    }
    if (!wrapped) wrapped = verifySignatureAppRouter(handler) as (
      req: Request,
    ) => Promise<Response> | Response
    return wrapped(req)
  }
}

// Convenience re-export so routes can pull both from one path.
export { verifySignatureAppRouter }
