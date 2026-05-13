// Route handler wrapper — catches ApiError + unknown errors and converts
// them into the standard error envelope. See docs/BACKEND.md §12.

import { NextResponse, type NextRequest } from 'next/server'
import type { ApiError as ApiErrorEnvelope } from '@athar/shared'
import { ApiError } from './errors.js'

/**
 * Generic Next.js route handler signature. `ctx` is the route context object
 * Next.js passes as the second argument (e.g. `{ params }`).
 *
 * Accepts either `Request` or `NextRequest` (Next.js superset) and may return
 * any Response variant — we relax to `Response` to support `streamText().toDataStreamResponse()`.
 */
export type RouteHandler<TCtx = unknown> = (
  req: NextRequest | Request,
  ctx: TCtx,
) => Promise<Response> | Response

/**
 * Wrap a route handler so that thrown `ApiError`s are converted to the
 * standard envelope and unexpected errors return `INTERNAL_ERROR` (logged
 * via `console.error`; Sentry wiring is handled separately).
 *
 * Usage:
 * ```ts
 * export const GET = withErrorHandling(async (req, ctx) => {
 *   const user = await requireUser(req)
 *   return ok(user)
 * })
 * ```
 */
export function withErrorHandling<TCtx = unknown>(
  handler: RouteHandler<TCtx>,
): (req: NextRequest | Request, ctx: TCtx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      if (ApiError.is(err)) {
        return err.toResponse()
      }
      // Unknown / unexpected — log and surface a generic INTERNAL_ERROR.
      console.error('[api] unhandled error', err)
      const body: ApiErrorEnvelope = {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      }
      return NextResponse.json(body, { status: 500 })
    }
  }
}
