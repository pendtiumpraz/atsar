'use client'

// Per-segment error boundary. Catches uncaught errors thrown in any
// server/client component under `(app)`. Next.js passes `reset` to retry
// the segment without a full page reload.
//
// Keep this client component small — it's loaded on the error path and
// must not import anything that might itself fail.

import { AlertTriangle, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Surface the error to the browser console so devs can inspect it
    // even if Sentry isn't wired yet. Server-side reporting happens in
    // `instrumentation.ts`.
    // eslint-disable-next-line no-console
    console.error('[app/error]', error)
  }, [error])

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-xl flex-col items-center gap-6 py-16 text-center"
    >
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--danger))]/10 text-[rgb(var(--danger))]"
      >
        <AlertTriangle className="h-8 w-8" strokeWidth={1.75} />
      </div>

      <div className="space-y-2">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Terjadi kesalahan
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Halaman ini tidak dapat dimuat. Tim kami sudah diberi tahu. Anda dapat mencoba
          memuat ulang, atau kembali ke dashboard.
        </p>
        {error.digest && (
          <p className="text-xs text-[rgb(var(--text-faint))]">
            Kode kesalahan: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[rgb(var(--primary))] px-4 text-sm font-medium text-[rgb(var(--primary-foreground))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Coba lagi
        </button>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-transparent px-4 text-sm font-medium text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--bg-elevated))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </div>
  )
}
