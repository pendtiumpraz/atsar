'use client'

/**
 * Navbar — App shell top bar.
 *
 * Spec refs:
 *  - docs/UI_UX.md §5 (Navbar — right cluster)
 *  - docs/WIREFRAMES.md §4 (App shell)
 *
 * Layout:
 *  - Sticky, 56px, backdrop-blur on scroll.
 *  - Left: hamburger (mobile) + Breadcrumb (from pathname segments).
 *  - Right cluster (UserMenu, CalendarToggle, ThemeToggle, NotificationBell,
 *    QuotaIndicator, AICreditChip) — kanan-ke-kiri sesuai UI_UX §5.
 */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AICreditChip } from './ai-credit-chip'
import { QuotaIndicator } from './quota-indicator'
import { NotificationBell } from './notification-bell'
import { CalendarToggle } from './calendar-toggle'
import { UserMenu } from './user-menu'
import { useMobileNav } from './mobile-nav-context'

// ─── Breadcrumb ──────────────────────────────────────────────────────────

interface Crumb {
  label: string
  href: string
}

function humanize(segment: string): string {
  if (!segment) return ''
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let acc = ''
  for (const part of parts) {
    acc += `/${part}`
    crumbs.push({ label: humanize(decodeURIComponent(part)), href: acc })
  }
  return crumbs
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = buildCrumbs(pathname)
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
      >
        Atsar
      </Link>
      {crumbs.map((c, i) => (
        <React.Fragment key={c.href}>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--text-faint))]" />
          {i === crumbs.length - 1 ? (
            <span
              aria-current="page"
              className="truncate text-sm font-semibold text-[rgb(var(--text))]"
            >
              {c.label}
            </span>
          ) : (
            <Link
              href={c.href}
              className="truncate text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
            >
              {c.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}

// ─── Theme toggle slot ───────────────────────────────────────────────────
// F2 owns `@/components/theme/theme-toggle`. We lazy-load to avoid hard
// failure if that file is still pending — the slot stays empty but the
// navbar continues to render. TODO: import directly once F2 ships.

function ThemeToggleSlot() {
  const [Comp, setComp] = React.useState<React.ComponentType | null>(null)
  React.useEffect(() => {
    let active = true
    import('@/components/theme/theme-toggle')
      .then((m) => {
        if (!active) return
        const C =
          (m as { ThemeToggle?: React.ComponentType; default?: React.ComponentType })
            .ThemeToggle ??
          (m as { default?: React.ComponentType }).default ??
          null
        if (C) setComp(() => C)
      })
      .catch(() => {
        /* theme module not present yet */
      })
    return () => {
      active = false
    }
  }, [])
  if (!Comp) return null
  return <Comp />
}

// ─── Public ──────────────────────────────────────────────────────────────

export interface NavbarProps {
  /** Bound to Sidebar mobile drawer. */
  onOpenMobileMenu?: () => void
}

export function Navbar({ onOpenMobileMenu }: NavbarProps) {
  const pathname = usePathname() ?? '/'
  const [scrolled, setScrolled] = React.useState(false)
  // Fallback to the shared MobileNav context when the parent layout doesn't
  // wire `onOpenMobileMenu` explicitly. This was the actual hamburger bug:
  // both (admin) and (app) layouts mount <Navbar /> bare → click did nothing.
  const mobileNav = useMobileNav()
  const handleHamburger = onOpenMobileMenu ?? (() => mobileNav.setOpen(true))

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-[200] h-14 w-full',
        'border-b border-[rgb(var(--border))]',
        'transition-colors duration-200',
        scrolled
          ? 'bg-[rgb(var(--bg)/0.8)] backdrop-blur supports-[backdrop-filter]:bg-[rgb(var(--bg)/0.6)]'
          : 'bg-[rgb(var(--bg))]',
      )}
    >
      <div className="flex h-full items-center gap-3 px-4">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={handleHamburger}
          aria-label="Buka menu"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Breadcrumb */}
        <div className="min-w-0 flex-1">
          <Breadcrumb pathname={pathname} />
        </div>

        {/* Right cluster — visual order matches UI_UX §5 (✨ 📥 🔔 🌙 ⊕ 👤) */}
        <div className="flex items-center gap-1.5">
          <AICreditChip />
          <QuotaIndicator />
          <NotificationBell />
          <ThemeToggleSlot />
          <CalendarToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

export default Navbar
