'use client'

/**
 * SidebarClient — App shell primary navigation (client renderer).
 *
 * Spec refs:
 *  - docs/UI_UX.md §4 (Sidebar — 1 warna ikon, active accent)
 *  - docs/WIREFRAMES.md §4 (App shell)
 *
 * Behavior:
 *  - Expanded (240px) / Collapsed (64px), persisted to localStorage.
 *  - Mobile (<lg): Sheet drawer (F1 shadcn Sheet — falls back to a built-in
 *    overlay drawer until F1 ships `@/components/ui/sheet`).
 *  - Icons single-color via `text-[rgb(var(--sidebar-icon))]`. Active state
 *    only changes icon + label color to accent.
 *  - Menu data: **received as props from the server wrapper**. No client
 *    fetch, no fallback array — eliminates the flicker between subscriber
 *    fallback and the actual (admin/reviewer) menu on every navigation.
 */

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as Lucide from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface MenuItem {
  slug: string
  label: string
  labelAr?: string
  icon: string // Lucide icon name
  path: string
  children?: MenuItem[]
}

const STORAGE_KEY = 'sidebar:collapsed'

// ─── Helpers ─────────────────────────────────────────────────────────────

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  if (!name) return Lucide.Circle
  const Icon = (Lucide as unknown as Record<string, unknown>)[name]
  return (Icon as React.ComponentType<{ className?: string }>) ?? Lucide.Circle
}

function isActivePath(pathname: string, itemPath: string): boolean {
  if (!itemPath) return false
  if (itemPath === '/') return pathname === '/'
  return pathname === itemPath || pathname.startsWith(itemPath + '/')
}

// ─── Logo ────────────────────────────────────────────────────────────────

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-5',
        collapsed && 'justify-center px-2',
      )}
      aria-label="Atsar"
    >
      <span
        lang="ar"
        dir="rtl"
        className="text-xl text-[rgb(var(--accent))]"
        style={{ fontFamily: 'var(--font-display-arab)' }}
      >
        أثر
      </span>
      {!collapsed && (
        <span className="text-sm font-semibold tracking-wide text-[rgb(var(--text))]">
          ATSAR
        </span>
      )}
    </div>
  )
}

// ─── Single nav link ─────────────────────────────────────────────────────

interface NavLinkProps {
  item: MenuItem
  active: boolean
  collapsed: boolean
}

function NavLink({ item, active, collapsed }: NavLinkProps) {
  const Icon = resolveIcon(item.icon)
  return (
    <Link
      href={item.path}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md transition-colors',
        'px-3 py-2 mx-2',
        collapsed ? 'justify-center px-2' : '',
        'hover:bg-[rgb(var(--bg-elevated))]',
        active
          ? 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--accent))]'
          : 'text-[rgb(var(--text))]',
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0',
          active
            ? 'text-[rgb(var(--sidebar-icon-active))]'
            : 'text-[rgb(var(--sidebar-icon))]',
        )}
      />
      {!collapsed && (
        <span className="truncate text-sm font-medium">{item.label}</span>
      )}
    </Link>
  )
}

// ─── Nav list ────────────────────────────────────────────────────────────

function NavList({
  items,
  pathname,
  collapsed,
}: {
  items: MenuItem[]
  pathname: string
  collapsed: boolean
}) {
  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-1 flex-col gap-0.5 overflow-y-auto py-2"
    >
      {items.map((item) => {
        if (item.slug === '__divider__') {
          return (
            <div
              key={`divider-${item.slug}-${item.path}`}
              className="my-2 border-t border-[rgb(var(--border))] mx-3"
              role="separator"
            />
          )
        }
        return (
          <NavLink
            key={item.slug}
            item={item}
            active={isActivePath(pathname, item.path)}
            collapsed={collapsed}
          />
        )
      })}
    </nav>
  )
}

// ─── Desktop shell ───────────────────────────────────────────────────────

function DesktopSidebar({
  items,
  pathname,
  collapsed,
  onToggle,
}: {
  items: MenuItem[]
  pathname: string
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        'hidden lg:flex h-screen flex-col border-r border-[rgb(var(--border))]',
        'bg-[rgb(var(--surface))] sticky top-0',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <Logo collapsed={collapsed} />
      <div className="border-t border-[rgb(var(--border))]" />
      <NavList items={items} pathname={pathname} collapsed={collapsed} />
      <div className="border-t border-[rgb(var(--border))] p-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2',
            'hover:bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))]',
            collapsed && 'justify-center px-2',
          )}
        >
          {collapsed ? (
            <Lucide.ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <Lucide.ChevronLeft className="h-4 w-4" />
              <span className="text-xs">Tutup</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

// ─── Mobile drawer ───────────────────────────────────────────────────────
// TODO: swap for `@/components/ui/sheet` once F1 ships the Sheet primitive.

function MobileDrawer({
  open,
  onOpenChange,
  items,
  pathname,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  items: MenuItem[]
  pathname: string
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div className="lg:hidden fixed inset-0 z-[300]">
      <button
        type="button"
        aria-label="Tutup menu"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        className={cn(
          'absolute left-0 top-0 h-full w-64 bg-[rgb(var(--surface))]',
          'border-r border-[rgb(var(--border))] flex flex-col',
          'animate-in slide-in-from-left duration-200',
        )}
      >
        <div className="flex items-center justify-between">
          <Logo collapsed={false} />
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Tutup"
            className="p-3 text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
          >
            <Lucide.X className="h-5 w-5" />
          </button>
        </div>
        <div className="border-t border-[rgb(var(--border))]" />
        <NavList items={items} pathname={pathname} collapsed={false} />
      </aside>
    </div>
  )
}

// ─── Public component ───────────────────────────────────────────────────

export interface SidebarClientProps {
  /** Menu items resolved by the server wrapper. No client refetch. */
  items: MenuItem[]
  /** Mobile drawer open state (parent-controlled via navbar hamburger). */
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function SidebarClient({
  items,
  mobileOpen = false,
  onMobileOpenChange,
}: SidebarClientProps) {
  const pathname = usePathname() ?? '/'

  // Start with `false` on both server and first client render to avoid a
  // hydration mismatch (localStorage isn't available during SSR). After
  // mount we read the persisted preference and apply it. The width
  // transition is CSS-animated so the brief flip looks smooth.
  const [collapsed, setCollapsed] = React.useState<boolean>(false)

  React.useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true)
    } catch {
      /* localStorage unavailable */
    }
  }, [])

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return (
    <>
      <DesktopSidebar
        items={items}
        pathname={pathname}
        collapsed={collapsed}
        onToggle={toggle}
      />
      <MobileDrawer
        open={mobileOpen}
        onOpenChange={onMobileOpenChange ?? (() => {})}
        items={items}
        pathname={pathname}
      />
    </>
  )
}

export default SidebarClient
