// POST /api/v1/uploads — generic file upload endpoint.
//
// Authenticated users can upload a file scoped to a `purpose` (doc analyzer,
// payment proof, avatar). MIME types are restricted per-purpose so the bucket
// can't receive arbitrary blobs. Returns `{ url, key }` — callers persist the
// key against their own resource (doc-analyze job, payment row, user profile).
//
// See docs/IDEAS.md §5 (doc analyzer ingestion) and §6.6 (payment proofs).

import { randomUUID } from 'node:crypto'
import { ApiError, ok, withErrorHandling } from '@/lib/server/api'
import { requireAuth } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { uploadFile } from '@/lib/server/uploads/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Generous timeout: large PDFs over S3 can be slow on cold connections.
export const maxDuration = 60

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB

type Purpose = 'doc_analyzer' | 'payment_proof' | 'avatar'

const PURPOSES = new Set<Purpose>(['doc_analyzer', 'payment_proof', 'avatar'])

/** MIME allow-list per purpose. Anything outside this is 422. */
const MIME_WHITELIST: Record<Purpose, ReadonlyArray<string>> = {
  doc_analyzer: [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
  ],
  payment_proof: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
  avatar: ['image/png', 'image/jpeg', 'image/webp'],
}

/**
 * Magic-byte sniff. The client-declared `file.type` is just an HTTP header
 * — an attacker can upload a `.php` payload tagged as `image/png` and the
 * MIME allow-list would pass it. This compares the first bytes of the
 * actual buffer against the well-known signature for each whitelisted
 * MIME. Returns `true` if the buffer looks like its claimed type.
 *
 * `text/plain` has no reliable signature; we sample the first 1024 bytes
 * and require all of them to be valid UTF-8 (no NUL bytes, no control
 * chars outside the usual whitespace) — a binary payload would fail.
 */
function verifyMagicBytes(buf: Buffer, mime: string): boolean {
  if (buf.length === 0) return false
  switch (mime) {
    case 'application/pdf':
      return buf.length >= 4 && buf.toString('latin1', 0, 4) === '%PDF'
    case 'image/png':
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      )
    case 'image/jpeg':
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
    case 'image/webp':
      // RIFF????WEBP
      return (
        buf.length >= 12 &&
        buf.toString('latin1', 0, 4) === 'RIFF' &&
        buf.toString('latin1', 8, 12) === 'WEBP'
      )
    case 'application/msword':
      // Compound File Binary (CFB / OLE2) — the legacy `.doc` container.
      return (
        buf.length >= 8 &&
        buf[0] === 0xd0 &&
        buf[1] === 0xcf &&
        buf[2] === 0x11 &&
        buf[3] === 0xe0 &&
        buf[4] === 0xa1 &&
        buf[5] === 0xb1 &&
        buf[6] === 0x1a &&
        buf[7] === 0xe1
      )
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      // DOCX is a ZIP container: PK\x03\x04 (or empty/sig variants 05/06).
      return (
        buf.length >= 4 &&
        buf[0] === 0x50 &&
        buf[1] === 0x4b &&
        (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
        (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08)
      )
    case 'application/rtf':
      return buf.length >= 5 && buf.toString('latin1', 0, 5) === '{\\rtf'
    case 'text/plain': {
      const sample = buf.slice(0, Math.min(1024, buf.length))
      // Cheap UTF-8 / printable check. Reject any NUL byte or control char
      // outside tab/newline/cr — strong signal of a binary masquerading as
      // plain text.
      for (let i = 0; i < sample.length; i++) {
        const b = sample[i]!
        if (b === 0x00) return false
        if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) return false
      }
      return true
    }
    default:
      // Unknown MIME — we shouldn't have reached here because the
      // allow-list filter runs first, but fail-closed just in case.
      return false
  }
}

/** Derive a safe file extension from MIME (fallback to `bin`). */
function extFromMime(mime: string, fallback: string | null): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf'
    case 'text/plain':
      return 'txt'
    case 'application/msword':
      return 'doc'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx'
    case 'application/rtf':
      return 'rtf'
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      // Best effort: trust the filename's own extension if it looks sane.
      if (fallback && /^[a-z0-9]{1,8}$/i.test(fallback)) return fallback.toLowerCase()
      return 'bin'
  }
}

export const POST = withErrorHandling(async (req) => {
  const { userId } = await requireAuth(req)

  // Reject obviously oversized requests before reading the body. The
  // `content-length` is a hint only — we still bound the buffer below.
  const declaredSize = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BYTES) {
    throw new ApiError('VALIDATION_ERROR', `File exceeds ${MAX_BYTES} bytes`)
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch (cause) {
    throw new ApiError('VALIDATION_ERROR', 'Expected multipart/form-data body', {
      cause,
    })
  }

  const purposeRaw = String(form.get('purpose') ?? '')
  if (!PURPOSES.has(purposeRaw as Purpose)) {
    throw new ApiError('VALIDATION_ERROR', `Invalid purpose: ${purposeRaw}`)
  }
  const purpose = purposeRaw as Purpose

  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new ApiError('VALIDATION_ERROR', 'Missing `file` field')
  }
  if (file.size === 0) {
    throw new ApiError('VALIDATION_ERROR', 'File is empty')
  }
  if (file.size > MAX_BYTES) {
    throw new ApiError('VALIDATION_ERROR', `File exceeds ${MAX_BYTES} bytes`)
  }

  const contentType = file.type || 'application/octet-stream'
  if (!MIME_WHITELIST[purpose].includes(contentType)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `MIME type ${contentType} not allowed for ${purpose}`,
    )
  }

  // Derive ext from filename if present, else from MIME.
  const filenameExt =
    file.name && file.name.includes('.') ? file.name.split('.').pop() ?? null : null
  const ext = extFromMime(contentType, filenameExt)

  const key = `${purpose}/${userId}/${randomUUID()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Defence in depth — verify the bytes match the declared MIME so a
  // PHP/JS payload renamed as image/png can't slip past the allow-list.
  // Mismatch yields a 422 (we do NOT log the buffer to avoid leaking
  // attacker-controlled bytes into Vercel log search).
  if (!verifyMagicBytes(buffer, contentType)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `File content does not match declared type ${contentType}`,
    )
  }

  const result = await uploadFile(buffer, key, contentType)

  // Fire-and-forget audit trail. `config_change` is the nearest enum value
  // for "user uploaded an artifact"; we encode the real semantics in
  // `resourceType: 'upload'` + the purpose in the diff so admins can filter.
  await auditLog.write({
    actorId: userId,
    actorRole: 'subscriber',
    action: 'create',
    resourceType: 'upload',
    resourceId: key,
    diff: {
      purpose,
      contentType,
      bytes: buffer.length,
      backend: result.backend,
    },
  })

  return ok({ url: result.url, key: result.key })
})
