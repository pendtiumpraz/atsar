// QStash signature verification.
// See docs/ARCHITECTURE.md §4 — HMAC Verification.
//
// QStash signs every webhook request with the current signing key. We must
// verify the signature on every `/api/jobs/*` handler so that strangers
// can't replay or forge job invocations.
//
// In practice route handlers use `verifySignatureAppRouter` from the SDK
// directly (see `app/api/jobs/_lib/with-signature.ts`). This module
// re-exports the SDK helper plus a `Receiver`-based check for ad-hoc use
// (e.g. internal RPC, tests).

import { Receiver } from '@upstash/qstash'

/**
 * Lazily-constructed `Receiver` — keys may be absent in local/CI, so we
 * defer the check to verify-time rather than module-load time.
 */
let _receiver: Receiver | null = null
function getReceiver(): Receiver {
  if (_receiver) return _receiver
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY
  if (!currentSigningKey || !nextSigningKey) {
    throw new Error(
      '[qstash] QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must be set to verify signatures',
    )
  }
  _receiver = new Receiver({ currentSigningKey, nextSigningKey })
  return _receiver
}

/**
 * Verify a QStash-signed Request. Throws when the signature is invalid or
 * missing. Returns the raw body string (useful so the caller can
 * `JSON.parse` without consuming the request body twice).
 *
 * Prefer `verifySignatureAppRouter` from `@upstash/qstash/nextjs` for
 * App Router routes — this helper exists for cases where you need manual
 * control (custom handlers, tests, Edge functions).
 */
export async function verifySignature(req: Request): Promise<string> {
  const signature = req.headers.get('upstash-signature')
  if (!signature) {
    throw new Error('[qstash] missing upstash-signature header')
  }
  const body = await req.text()
  const valid = await getReceiver().verify({
    signature,
    body,
    // `url` is required so QStash signs (url + body); reconstruct from the
    // incoming Request which is what QStash actually called.
    url: req.url,
  })
  if (!valid) {
    throw new Error('[qstash] invalid signature')
  }
  return body
}

// Re-export the App Router helper as the canonical way to guard routes.
// Routes should `import { verifySignatureAppRouter } from '@/lib/server/qstash'`.
export { verifySignatureAppRouter } from '@upstash/qstash/nextjs'
