// ApiError class + error envelope helpers.
// See docs/BACKEND.md §3 (error codes) and §12 (error handling).

import { NextResponse } from 'next/server'
import type { ApiError as ApiErrorEnvelope } from '@athar/shared'

/**
 * All known API error codes. Mapped to HTTP status by `codeToStatus`.
 */
export type ApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'CONFLICT'
  | 'EXTERNAL_AI_ERROR'
  | 'INTERNAL_ERROR'
  | 'SUBSCRIPTION_EXPIRED'

/**
 * Options accepted by the `ApiError` constructor.
 */
export interface ApiErrorOptions {
  details?: unknown
  fieldErrors?: Record<string, string>
  cause?: unknown
}

/**
 * Map an `ApiErrorCode` to its HTTP status code.
 */
export function codeToStatus(code: ApiErrorCode): number {
  switch (code) {
    case 'AUTH_REQUIRED':
    case 'AUTH_INVALID':
      return 401
    case 'PERMISSION_DENIED':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'VALIDATION_ERROR':
      return 422
    case 'RATE_LIMITED':
    case 'QUOTA_EXCEEDED':
      return 429
    case 'CONFLICT':
      return 409
    case 'EXTERNAL_AI_ERROR':
      return 502
    case 'SUBSCRIPTION_EXPIRED':
      return 402
    case 'INTERNAL_ERROR':
      return 500
  }
}

/**
 * Domain error thrown by services / route handlers. Caught by
 * `withErrorHandling` and converted into the standard error envelope.
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode
  public readonly details?: unknown
  public readonly fieldErrors?: Record<string, string>

  constructor(code: ApiErrorCode, message: string, options: ApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'ApiError'
    this.code = code
    this.details = options.details
    this.fieldErrors = options.fieldErrors
    // Preserve prototype chain (needed when transpiled to ES5; harmless otherwise).
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  /** Plain object form, suitable for JSON serialization in the error envelope. */
  toJSON(): ApiErrorEnvelope['error'] {
    const payload: ApiErrorEnvelope['error'] = {
      code: this.code,
      message: this.message,
    }
    if (this.details !== undefined) payload.details = this.details
    if (this.fieldErrors !== undefined) payload.fieldErrors = this.fieldErrors
    return payload
  }

  /** HTTP status that corresponds to this error's code. */
  get status(): number {
    return codeToStatus(this.code)
  }

  /** Build a `NextResponse` carrying the standard error envelope. */
  toResponse(meta?: Record<string, unknown>): NextResponse<ApiErrorEnvelope> {
    const body: ApiErrorEnvelope = meta
      ? { ok: false, error: this.toJSON(), meta }
      : { ok: false, error: this.toJSON() }
    return NextResponse.json(body, { status: this.status })
  }

  /** Type guard. */
  static is(err: unknown): err is ApiError {
    return err instanceof ApiError
  }
}
