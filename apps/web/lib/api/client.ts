// Browser-side fetch wrapper for the Atsar HTTP API.
//
// - Always prepends `/api/v1` unless the caller passes a path that already
//   starts with `/api/` (escape hatch for non-v1 endpoints like /api/auth or
//   /api/jobs/*).
// - Sets `Content-Type: application/json` when a plain-object body is supplied
//   (and stringifies it). Passes other body types — FormData, Blob, string —
//   through untouched so file uploads keep their multipart boundary.
// - Sends `credentials: 'include'` so the better-auth session cookie travels
//   along with cross-origin previews.
// - Adds an `Idempotency-Key` header when `init.idempotencyKey` is set —
//   matches the backend `withErrorHandling` middleware contract.
// - Reads the standard `{ ok, data, meta } | { ok, error }` envelope and
//   throws a typed `ApiClientError` whenever the request is unsuccessful.
//
// Convenience verbs (`api.get`, `api.post`, etc.) are attached to the main
// `api` function so call sites stay terse.

import type { ApiResponse } from '@athar/shared'

const API_PREFIX = '/api/v1'

/** Error thrown for any non-OK API result — either non-2xx HTTP or `ok: false`. */
export class ApiClientError extends Error {
  public readonly code: string
  public readonly fieldErrors?: Record<string, string>
  public readonly status?: number
  public readonly details?: unknown

  constructor(
    code: string,
    message: string,
    fieldErrors?: Record<string, string>,
    status?: number,
    details?: unknown,
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.fieldErrors = fieldErrors
    this.status = status
    this.details = details
    Object.setPrototypeOf(this, ApiClientError.prototype)
  }

  static is(err: unknown): err is ApiClientError {
    return err instanceof ApiClientError
  }
}

/** Extension of fetch RequestInit used by `api()`. */
export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  /** Plain object / FormData / Blob / string / null — see `api()` for handling. */
  body?: unknown
  /** Adds an `Idempotency-Key` header for mutating requests. */
  idempotencyKey?: string
}

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/api/')) return path
  // Allow callers to pass either `/figures` or `figures` after the prefix.
  const normalised = path.startsWith('/') ? path : `/${path}`
  return `${API_PREFIX}${normalised}`
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function shouldSerialiseAsJson(body: unknown): body is Record<string, unknown> | unknown[] {
  if (body == null) return false
  if (typeof body === 'string') return false
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return false
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false
  return Array.isArray(body) || isPlainObject(body)
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text()
  let parsed: ApiResponse<T> | undefined
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text) as ApiResponse<T>
    } catch {
      // Fall through — we'll surface a synthetic error below.
    }
  }

  // No JSON body — typical for 204 No Content or network-level errors.
  if (!parsed) {
    if (res.ok) return undefined as unknown as T
    throw new ApiClientError(
      'INTERNAL_ERROR',
      res.statusText || `Request failed with status ${res.status}`,
      undefined,
      res.status,
    )
  }

  if (parsed.ok) return parsed.data
  throw new ApiClientError(
    parsed.error.code,
    parsed.error.message,
    parsed.error.fieldErrors,
    res.status,
    parsed.error.details,
  )
}

async function apiFn<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { body, idempotencyKey, headers: initHeaders, ...rest } = init

  const headers = new Headers(initHeaders)
  let finalBody: BodyInit | undefined

  if (body !== undefined && body !== null) {
    if (shouldSerialiseAsJson(body)) {
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
      finalBody = JSON.stringify(body)
    } else {
      finalBody = body as BodyInit
    }
  }

  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  const res = await fetch(buildUrl(path), {
    credentials: 'include',
    ...rest,
    headers,
    body: finalBody,
  })

  return parseEnvelope<T>(res)
}

type ApiVerb = <T = unknown>(
  path: string,
  body?: unknown,
  init?: Omit<ApiRequestInit, 'body' | 'method'>,
) => Promise<T>

type ApiVerbNoBody = <T = unknown>(
  path: string,
  init?: Omit<ApiRequestInit, 'body' | 'method'>,
) => Promise<T>

/** Main API call function plus verb shortcuts. */
export interface ApiFn {
  <T = unknown>(path: string, init?: ApiRequestInit): Promise<T>
  get: ApiVerbNoBody
  delete: ApiVerbNoBody
  post: ApiVerb
  put: ApiVerb
  patch: ApiVerb
}

const apiBase = apiFn as ApiFn

apiBase.get = ((path, init) => apiBase(path, { ...init, method: 'GET' })) as ApiVerbNoBody
apiBase.delete = ((path, init) =>
  apiBase(path, { ...init, method: 'DELETE' })) as ApiVerbNoBody
apiBase.post = ((path, body, init) =>
  apiBase(path, { ...init, method: 'POST', body })) as ApiVerb
apiBase.put = ((path, body, init) =>
  apiBase(path, { ...init, method: 'PUT', body })) as ApiVerb
apiBase.patch = ((path, body, init) =>
  apiBase(path, { ...init, method: 'PATCH', body })) as ApiVerb

export const api = apiBase
