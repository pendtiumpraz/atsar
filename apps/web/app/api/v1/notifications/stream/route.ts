// GET /api/v1/notifications/stream — Server-Sent Events stream of the
// current user's notifications.
//
// Vercel/serverless caveats:
//   - `runtime = 'nodejs'` so streaming + setTimeout work reliably.
//   - `dynamic = 'force-dynamic'` to bypass static optimization.
//   - `maxDuration = 60` (Vercel hobby/pro limit); the browser EventSource
//     auto-reconnects on close, so a short max duration is fine.
//
// TODO(v2 pubsub): Upstash Redis REST does not support `SUBSCRIBE`.  This
// route currently polls the `notifications` table every 5s for rows newer
// than the cursor we send with each event.  Migrate to Pusher / Ably /
// native Vercel SSE infra when available.

import { ApiError } from '@/lib/server/api'
import { auth } from '@/lib/server/auth'
import { notificationService } from '@/lib/server/services/notification.service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const POLL_INTERVAL_MS = 5_000
const HEARTBEAT_INTERVAL_MS = 15_000

/** Encode a single SSE frame. */
function sseFrame(event: string, data: unknown): Uint8Array {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  return new TextEncoder().encode(`event: ${event}\ndata: ${payload}\n\n`)
}

export async function GET(req: Request): Promise<Response> {
  const session = await auth.api.getSession({ headers: req.headers })
  const userId = session?.user?.id
  if (!userId) {
    return new ApiError('AUTH_REQUIRED', 'Anda harus login terlebih dahulu.').toResponse()
  }

  const signal = req.signal

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const close = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return
        try {
          controller.enqueue(chunk)
        } catch {
          close()
        }
      }

      // Cursor starts at "now" — only deliver notifications created after
      // the client connects.  Clients can fetch the historical list via
      // GET /api/v1/notifications.
      let cursor = new Date()

      // Initial greeting frame — gives the client a confirmed connection.
      safeEnqueue(sseFrame('ready', { since: cursor.toISOString() }))

      // Heartbeat keeps proxies from idling out the connection.
      const heartbeat = setInterval(() => {
        if (closed) return
        // SSE comment line is ignored by clients but keeps the socket warm.
        safeEnqueue(new TextEncoder().encode(`: heartbeat ${Date.now()}\n\n`))
      }, HEARTBEAT_INTERVAL_MS)

      // Abort wiring — exit promptly when the client disconnects.
      const onAbort = () => {
        clearInterval(heartbeat)
        close()
      }
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })

      // Poll loop: while connected, ask for rows newer than cursor every 5s.
      try {
        while (!closed && !signal.aborted) {
          const rows = await notificationService.listSince(userId, cursor).catch((err) => {
            console.error('[notifications/stream] listSince failed', { userId, err })
            return []
          })

          if (rows.length > 0) {
            for (const row of rows) {
              safeEnqueue(sseFrame('notification', row))
            }
            // Advance cursor to the newest createdAt we just delivered.
            const latest = rows[rows.length - 1]!.createdAt
            cursor = latest instanceof Date ? latest : new Date(latest as unknown as string)
          }

          // Wait POLL_INTERVAL_MS or abort early.
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, POLL_INTERVAL_MS)
            const cancel = () => {
              clearTimeout(t)
              resolve()
            }
            if (signal.aborted) cancel()
            else signal.addEventListener('abort', cancel, { once: true })
          })
        }
      } finally {
        clearInterval(heartbeat)
        close()
      }
    },
    cancel() {
      // No-op: cleanup happens in the abort listener inside `start`.
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      // Disable buffering on common reverse proxies (nginx, etc).
      'x-accel-buffering': 'no',
    },
  })
}
