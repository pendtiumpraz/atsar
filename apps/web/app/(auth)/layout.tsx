import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Auth layout — centered single-column shell used by:
 *   /login, /register, /verify-email, /forgot-password, /reset-password
 *
 * No sidebar/navbar (per WIREFRAMES §2). The Atsar wordmark is shown at the
 * top, the page content is rendered inside a centered card. Dark/light is
 * inherited automatically via the `data-theme` attribute on `<html>`.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'rgb(var(--bg))' }}
    >
      <Link
        href="/"
        className="mb-8 flex flex-col items-center gap-1 text-center"
        aria-label="Atsar — kembali ke beranda"
      >
        <span
          className="text-5xl leading-none"
          style={{
            fontFamily: 'var(--font-display-arab)',
            color: 'rgb(var(--primary))',
          }}
          dir="rtl"
          lang="ar"
        >
          أثر
        </span>
        <span
          className="text-xl font-semibold tracking-[0.25em]"
          style={{
            fontFamily: 'var(--font-display-latin)',
            color: 'rgb(var(--text))',
          }}
        >
          ATSAR
        </span>
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p
        className="mt-8 text-center text-xs"
        style={{ color: 'rgb(var(--text-faint))' }}
      >
        © Atsar — Jejak generasi terbaik, dalam genggamanmu.
      </p>
    </main>
  )
}
