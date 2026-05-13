// Public marketing shell. No auth check — this is the publicly-indexable
// surface (landing, /pricing, /about, /kontak). Simple sticky header +
// content + footer; fully responsive.
//
// Note: the route group `(marketing)` is stripped from URLs by Next.js, so
// `(marketing)/pricing/page.tsx` resolves at `/pricing`.

import Link from 'next/link'
import type { ReactNode } from 'react'

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  )
}

function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/85 backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--bg))]/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] rounded-md"
          aria-label="Atsar — beranda"
        >
          <span
            className="text-2xl font-bold leading-none"
            style={{ fontFamily: 'var(--font-display-arab)', color: 'rgb(var(--primary))' }}
            dir="rtl"
            lang="ar"
            aria-hidden="true"
          >
            أثر
          </span>
          <span
            className="text-lg font-semibold tracking-wide"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Atsar
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm md:flex" aria-label="Navigasi utama">
          <Link
            href="/pricing"
            className="text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]"
          >
            Harga
          </Link>
          <Link
            href="/about"
            className="text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]"
          >
            Tentang
          </Link>
          <Link
            href="/kontak"
            className="text-[rgb(var(--text-muted))] transition-colors hover:text-[rgb(var(--text))]"
          >
            Kontak
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] sm:inline-flex"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="inline-flex h-9 items-center justify-center rounded-md bg-[rgb(var(--primary))] px-4 text-sm font-medium text-[rgb(var(--primary-foreground))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
          >
            Daftar
          </Link>
        </div>
      </div>
    </header>
  )
}

function MarketingFooter() {
  return (
    <footer className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-xl font-bold leading-none"
              style={{ fontFamily: 'var(--font-display-arab)', color: 'rgb(var(--primary))' }}
              dir="rtl"
              lang="ar"
              aria-hidden="true"
            >
              أثر
            </span>
            <span
              className="text-base font-semibold"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              Atsar
            </span>
          </div>
          <p className="mt-2 max-w-xs text-sm text-[rgb(var(--text-muted))]">
            Jejak generasi terbaik, dalam genggamanmu.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            Produk
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/pricing" className="hover:text-[rgb(var(--accent))]">
                Harga
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[rgb(var(--accent))]">
                Tentang
              </Link>
            </li>
            <li>
              <Link href="/kontak" className="hover:text-[rgb(var(--accent))]">
                Kontak
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            Hukum
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/legal/privacy" className="hover:text-[rgb(var(--accent))]">
                Kebijakan privasi
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="hover:text-[rgb(var(--accent))]">
                Syarat layanan
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[rgb(var(--border))]">
        <p className="mx-auto w-full max-w-6xl px-4 py-4 text-center text-xs text-[rgb(var(--text-faint))] sm:px-6">
          © {new Date().getFullYear()} Atsar. Seluruh konten bersumber dari salaf — semoga
          bermanfaat.
        </p>
      </div>
    </footer>
  )
}
