// File storage adapter — S3-compatible PUT when `S3_ENDPOINT` is configured,
// otherwise a placeholder stub useful for local dev / CI where no real bucket
// is wired up yet.
//
// IDEAS.md §5 (Doc Analyzer) needs admins to upload PDFs/text. The doc-analyze
// flow only needs `{ url, key }` back from this module; the AI worker can
// re-read by `key` once we add a `downloadFile` companion (TODO v2).
//
// Future work:
//   - swap the stub branch for real persistence (e.g. Vercel Blob, R2).
//   - add `downloadFile(key)` + signed-url generation for private buckets.
//   - virus scan + checksum verification before returning the URL.

import { createHash, createHmac } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Result of a storage put. `url` is suitable for storing alongside the
 * resource record; for the stub adapter it is a `placeholder://` URI that
 * downstream code can detect (see `isPlaceholderUrl`).
 */
export interface UploadResult {
  /** Public (or placeholder) URL the consumer should persist. */
  url: string
  /** Storage key — stable identifier we can re-derive the URL from. */
  key: string
  /** Which backend handled the upload. Useful for audit logs. */
  backend: 's3' | 'vercel-blob' | 'local-stub'
}

/** True when the URL was produced by the stub backend. */
export function isPlaceholderUrl(url: string): boolean {
  return url.startsWith('placeholder://')
}

/** Read S3 config from env, returning `null` if any required piece is missing. */
function readS3Config(): null | {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl?: string
} {
  const endpoint = process.env.S3_ENDPOINT
  const bucket = process.env.S3_BUCKET
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  return {
    endpoint: endpoint.replace(/\/$/, ''),
    region: process.env.S3_REGION ?? 'auto',
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  }
}

// ─── AWS SigV4 minimal implementation ──────────────────────────────────
// We sign a single PUT request to keep this file dep-free. If `aws4fetch`
// becomes available transitively later we can swap to it; the public API
// (`uploadFile`) won't change.
//
// References:
//   https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html

function hmacSha256(key: ArrayBuffer | Buffer | string, data: string): Buffer {
  return createHmac('sha256', key as Buffer).update(data).digest()
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex')
}

function amzDate(now: Date): { amz: string; date: string } {
  // `YYYYMMDDTHHMMSSZ` and `YYYYMMDD`.
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amz: iso, date: iso.slice(0, 8) }
}

interface S3PutArgs {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  key: string
  body: Buffer
  contentType: string
}

async function s3Put(args: S3PutArgs): Promise<string> {
  const now = new Date()
  const { amz, date } = amzDate(now)
  const service = 's3'

  const host = new URL(args.endpoint).host
  // Path-style URL works for most S3-compatible providers (R2, MinIO, B2).
  const canonicalUri = `/${args.bucket}/${args.key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  const url = `${args.endpoint}${canonicalUri}`

  const payloadHash = sha256Hex(args.body)
  const headers: Record<string, string> = {
    host,
    'content-type': args.contentType,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amz,
  }

  const signedHeaders = Object.keys(headers).sort().join(';')
  const canonicalHeaders =
    Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}`)
      .join('\n') + '\n'

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${date}/${args.region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amz,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = hmacSha256(`AWS4${args.secretAccessKey}`, date)
  const kRegion = hmacSha256(kDate, args.region)
  const kService = hmacSha256(kRegion, service)
  const kSigning = hmacSha256(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${args.accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  // Wrap in a Blob so the body type satisfies the DOM `BodyInit` union
  // tsc resolves against under the `lib.dom` ambient (Node's undici fetch
  // happily consumes a Blob at runtime).
  const blob = new Blob([new Uint8Array(args.body)], { type: args.contentType })
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...headers, Authorization: authorization },
    body: blob,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`S3 PUT ${res.status} ${res.statusText}: ${text.slice(0, 500)}`)
  }
  return url
}

// ─── Local stub (dev) ──────────────────────────────────────────────────
async function localStubPut(key: string, body: Buffer): Promise<string> {
  const root = path.resolve(process.cwd(), 'storage', 'uploads')
  const target = path.join(root, key)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, body)
  return `placeholder://${key}`
}

/**
 * Upload a buffer to the configured storage backend.
 *
 * Behaviour:
 *   - S3 (when `S3_ENDPOINT` + creds set) → signed PUT, returns the object URL
 *     or `${S3_PUBLIC_BASE_URL}/${key}` if a CDN/public base is configured.
 *   - Otherwise → writes to `<cwd>/storage/uploads/<key>` and returns
 *     `placeholder://<key>` so callers can still persist a reference.
 *
 * @param buffer       Raw bytes to upload.
 * @param key          Storage key (e.g. `doc_analyzer/<userId>/<uuid>.pdf`).
 * @param contentType  MIME type sent as `Content-Type` and reused in
 *                     the SigV4 canonical request.
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<UploadResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error('uploadFile: empty buffer')
  }

  // ── Preference order ──
  //   1. Vercel Blob (`BLOB_READ_WRITE_TOKEN` set) — primary storage for all
  //      uploads (payment proof, doc analyzer, avatar, figure illustration).
  //      Required on Vercel because the serverless filesystem is read-only.
  //   2. S3-compatible (when `S3_ENDPOINT` + creds set) — opt-in for hosted
  //      MinIO / R2 / B2 / AWS deploys.
  //   3. Local stub — dev/CI fallback that writes under `storage/uploads/`.
  if (process.env['BLOB_READ_WRITE_TOKEN']) {
    // Dynamic import keeps `@vercel/blob` out of the bundle when the token
    // isn't configured (e.g. local dev without Blob set up).
    const { put } = await import('@vercel/blob')
    const result = await put(key, buffer, {
      access: 'public',
      contentType,
      // `addRandomSuffix: false` because `key` already includes a uuid.
      addRandomSuffix: false,
      token: process.env['BLOB_READ_WRITE_TOKEN'],
    })
    return { url: result.url, key, backend: 'vercel-blob' }
  }

  const cfg = readS3Config()
  if (cfg) {
    const objectUrl = await s3Put({
      endpoint: cfg.endpoint,
      region: cfg.region,
      bucket: cfg.bucket,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      key,
      body: buffer,
      contentType,
    })
    const url = cfg.publicBaseUrl
      ? `${cfg.publicBaseUrl.replace(/\/$/, '')}/${key}`
      : objectUrl
    return { url, key, backend: 's3' }
  }

  // Dev fallback. On Vercel without Blob or S3 configured, this throws on
  // write (serverless fs is read-only) — call sites must surface a clear
  // error.
  const url = await localStubPut(key, buffer)
  return { url, key, backend: 'local-stub' }
}
