'use client'

// Root-level error boundary. Catches errors NOT handled by a more specific
// `error.tsx` further down the tree. Must be a client component — Next.js
// requirement.
//
// Note: Next.js also looks for a sibling `global-error.tsx` to handle
// errors thrown from the root layout itself. This file handles everything
// underneath a successful root layout render.

import { AlertOctagon, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[app/error:root]', error)
  }, [error])

  return (
    <main
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--bg))] px-4 py-16 text-center text-[rgb(var(--text))]"
    >
      <div className="flex max-w-xl flex-col items-center gap-6">
        {/* Athar mark, faded — we're in a bad state, don't shout. */}
        <div className="flex items-center gap-3 opacity-60">
          <span
            className="text-4xl leading-none"
            style={{ fontFamily: 'var(--font-display-arab)', color: 'rgb(var(--primary))' }}
            dir="rtl"
            lang="ar"
            aria-hidden="true"
          >
            أثر
          </span>
        </div>

        <div
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--danger))]/10 text-[rgb(var(--danger))]"
        >
          <AlertOctagon className="h-8 w-8" strokeWidth={1.75} />
        </div>

        <div className="space-y-2">
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Server bermasalah
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Kami mengalami kendala teknis. Tim kami sudah dinotifikasi dan sedang
            menanganinya. Silakan coba lagi sebentar.
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
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-transparent px-4 text-sm font-medium text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--bg-elevated))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    </main>
  )
}
