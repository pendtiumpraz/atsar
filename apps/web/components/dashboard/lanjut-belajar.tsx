'use client'

// "Lanjut Belajar" panel — resume cards for figures / battles in progress.
//
// Stub for Phase 4: the read-tracking endpoint doesn't exist yet (see
// IMPLEMENTATION_PLAN). When the parent has no items to show we render a
// gentle empty state pointing at /figures. The client boundary is here
// because future iterations will hydrate the progress bars from
// TanStack Query (per-figure read percentages).

import Link from 'next/link'
import { ArrowRight, BookmarkPlus } from 'lucide-react'

export interface LanjutItem {
  href: string
  title: string
  subtitle?: string
  /** 0–100. Optional — omitted items render as "Baru dimulai". */
  progress?: number
}

interface LanjutBelajarProps {
  items?: ReadonlyArray<LanjutItem>
}

export function LanjutBelajar({ items = [] }: LanjutBelajarProps) {
  const hasItems = items.length > 0

  return (
    <section
      aria-labelledby="lanjut-belajar-heading"
      className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <h2
          id="lanjut-belajar-heading"
          className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
        >
          Lanjut Belajar
        </h2>
        {hasItems ? (
          <Link
            href="/figures"
            className="inline-flex items-center gap-1 text-xs text-[rgb(var(--accent))] hover:underline"
          >
            Semua tokoh <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        ) : null}
      </header>

      {hasItems ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 transition-colors hover:border-[rgb(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[rgb(var(--text))]">
                    {item.title}
                  </span>
                  <span className="flex-none text-[10px] uppercase tracking-wide text-[rgb(var(--text-faint))]">
                    {typeof item.progress === 'number'
                      ? `${Math.round(item.progress)}%`
                      : 'Baru dimulai'}
                  </span>
                </div>
                {item.subtitle ? (
                  <p className="mt-0.5 truncate text-xs text-[rgb(var(--text-muted))]">
                    {item.subtitle}
                  </p>
                ) : null}
                {typeof item.progress === 'number' ? (
                  <div
                    className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-elevated))]"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress)}
                  >
                    <div
                      className="h-full rounded-full bg-[rgb(var(--primary))] transition-[width]"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4 text-center">
          <BookmarkPlus
            aria-hidden="true"
            className="mx-auto h-6 w-6 text-[rgb(var(--text-faint))]"
            strokeWidth={1.5}
          />
          <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">
            Belum ada tokoh yang dimulai.
          </p>
          <Link
            href="/figures"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[rgb(var(--accent))] hover:underline"
          >
            Telusuri tokoh <ArrowRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  )
}
