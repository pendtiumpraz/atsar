// Zod-powered validation helpers for request body, query, and route params.
// Throws `ApiError('VALIDATION_ERROR', ...)` with `fieldErrors` populated
// from the zod error tree. See docs/BACKEND.md §7.

import type { ZodError, ZodIssue, ZodTypeAny, z } from 'zod'
import { ApiError } from './errors.js'

/**
 * Flatten a zod issue path into a dotted/bracketed string.
 * `['user', 'addresses', 0, 'city']` → `user.addresses[0].city`
 */
function pathToString(path: ReadonlyArray<PropertyKey>): string {
  let out = ''
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`
    } else {
      out += out.length ? `.${String(seg)}` : String(seg)
    }
  }
  return out || '_'
}

/**
 * Build a `fieldErrors` map (path → first message) from a `ZodError`.
 */
function toFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues as ZodIssue[]) {
    const key = pathToString(issue.path)
    // Keep the first error message per field (most actionable).
    if (!(key in out)) out[key] = issue.message
  }
  return out
}

/**
 * Throw a standard `VALIDATION_ERROR` from a `ZodError`.
 */
function throwValidationError(error: ZodError, message = 'Validation failed'): never {
  throw new ApiError('VALIDATION_ERROR', message, {
    details: error.issues,
    fieldErrors: toFieldErrors(error),
    cause: error,
  })
}

/**
 * Parse and validate a JSON request body against the given zod schema.
 * Throws `ApiError('VALIDATION_ERROR')` on failure (including invalid JSON).
 */
export async function validateBody<S extends ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<z.output<S>> {
  let json: unknown
  try {
    json = await req.json()
  } catch (cause) {
    throw new ApiError('VALIDATION_ERROR', 'Invalid JSON body', { cause })
  }
  const result = schema.safeParse(json)
  if (!result.success) throwValidationError(result.error, 'Invalid request body')
  return result.data
}

/**
 * Validate `URLSearchParams` against a zod schema. The schema receives a
 * plain object; repeated keys are collapsed into arrays.
 */
export function validateQuery<S extends ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: S,
): z.output<S> {
  const obj: Record<string, string | string[]> = {}
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    obj[key] = values.length > 1 ? values : (values[0] ?? '')
  }
  const result = schema.safeParse(obj)
  if (!result.success) throwValidationError(result.error, 'Invalid query parameters')
  return result.data
}

/**
 * Validate route params (the object Next.js passes in `ctx.params`) against
 * a zod schema. Accepts an already-resolved object.
 */
export function validateParams<S extends ZodTypeAny>(
  params: unknown,
  schema: S,
): z.output<S> {
  const result = schema.safeParse(params)
  if (!result.success) throwValidationError(result.error, 'Invalid route parameters')
  return result.data
}
