// "Akses Cepat" — four entry points to the main app surfaces.
//
// Server component, no client state. Renders a 2x2 button grid that
// jumps to /figures, /map, /pdf-builder, /chat per WIREFRAMES §5.
// Lucide icons keep it visually consistent with the feature grid.

import Link from 'next/link'
import { BookOpenText, Bot, FileText, Map } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Shortcut {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const SHORTCUTS: ReadonlyArray<Shortcut> = [
  {
    href: '/figures',
    label: 'Tokoh',
    description: 'Telusuri nabi, sahabat, tabi’in, ulama salaf.',
    icon: BookOpenText,
  },
  {
    href: '/map',
    label: 'Peta',
    description: 'Geo-historis perang, hijrah, dan rihlah.',
    icon: Map,
  },
  {
    href: '/pdf-builder',
    label: 'PDF Builder',
    description: 'Susun buku biografi siap cetak.',
    icon: FileText,
  },
  {
    href: '/chat',
    label: 'AI Chat',
    description: 'Tanya jawab bersumber salaf.',
    icon: Bot,
  },
]

export function QuickAccess() {
  return (
    <section
      aria-labelledby="quick-access-heading"
      className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
    >
      <h2
        id="quick-access-heading"
        className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
      >
        Akses Cepat
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SHORTCUTS.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex items-start gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 transition-colors hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[rgb(var(--primary)/0.10)] text-[rgb(var(--primary))] transition-colors group-hover:bg-[rgb(var(--primary)/0.18)]"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[rgb(var(--text))]">
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-[rgb(var(--text-muted))]">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
