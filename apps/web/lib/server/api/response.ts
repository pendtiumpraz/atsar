// Success response helpers — wrap data in the standard ApiSuccess envelope.
// See docs/BACKEND.md §3 for the envelope shape.

import { NextResponse } from 'next/server'
import type { ApiSuccess } from '@athar/shared'

/**
 * Pagination metadata appended to list responses.
 */
export interface PaginationMeta {
  page: number
  perPage: number
  total: number
  totalPages?: number
}

/**
 * Optional meta fields attached to a successful response.
 * Extra arbitrary keys are allowed (e.g. `executionTimeMs`, `requestId`).
 */
export type ResponseMeta = Record<string, unknown>

/**
 * Return a successful JSON response wrapped in the ApiSuccess envelope.
 *
 * @param data - Payload body.
 * @param meta - Optional metadata (e.g. timing, request id).
 * @param init - Optional response init (status defaults to 200).
 */
export function ok<T>(
  data: T,
  meta?: ResponseMeta,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T>> {
  const body: ApiSuccess<T> = meta ? { ok: true, data, meta } : { ok: true, data }
  return NextResponse.json(body, { status: 200, ...init })
}

/**
 * Return a paginated list response. Merges pagination fields into `meta`.
 *
 * @param data - Array payload.
 * @param pagination - Pagination metadata (page, perPage, total).
 * @param extraMeta - Optional extra meta fields to merge.
 * @param init - Optional response init.
 */
export function paginatedOk<T>(
  data: T[],
  pagination: PaginationMeta,
  extraMeta?: ResponseMeta,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T[]>> {
  const totalPages =
    pagination.totalPages ??
    (pagination.perPage > 0 ? Math.ceil(pagination.total / pagination.perPage) : 0)

  const meta: ResponseMeta = {
    ...extraMeta,
    page: pagination.page,
    perPage: pagination.perPage,
    total: pagination.total,
    totalPages,
  }

  const body: ApiSuccess<T[]> = { ok: true, data, meta }
  return NextResponse.json(body, { status: 200, ...init })
}

/**
 * Return a 201 Created response. Convenience wrapper around `ok`.
 */
export function created<T>(
  data: T,
  meta?: ResponseMeta,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T>> {
  return ok(data, meta, { status: 201, ...init })
}

/**
 * Return a 204 No Content response (no body).
 */
export function noContent(init?: ResponseInit): NextResponse {
  return new NextResponse(null, { status: 204, ...init })
}
