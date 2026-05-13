// Global 404 page (Next.js convention).
//
// Triggered for any unmatched route OR when a server component calls
// `notFound()` from `next/navigation`. Server component — no client JS.

import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[rgb(var(--bg))] px-4 py-16 text-center text-[rgb(var(--text))]">
      <div className="flex flex-col items-center gap-6">
        {/* Atsar brand mark */}
        <div className="flex items-center gap-3">
          <span
            className="text-5xl leading-none"
            style={{ fontFamily: 'var(--font-display-arab)', color: 'rgb(var(--primary))' }}
            dir="rtl"
            lang="ar"
            aria-hidden="true"
          >
            أثر
          </span>
        </div>

        <p
          className="text-6xl font-bold tracking-tight text-[rgb(var(--accent))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          404
        </p>

        <div className="space-y-2">
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Halaman tidak ditemukan
          </h1>
          <p className="max-w-md text-sm text-[rgb(var(--text-muted))]">
            Jejak yang Anda cari mungkin telah dipindahkan, dihapus, atau memang tidak
            pernah ada. Kembali ke beranda untuk melanjutkan penelusuran.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-[rgb(var(--primary))] px-4 text-sm font-medium text-[rgb(var(--primary-foreground))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
          >
            Kembali ke beranda
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-transparent px-4 text-sm font-medium text-[rgb(var(--text))] transition-colors hover:bg-[rgb(var(--bg-elevated))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
          >
            Ke dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
