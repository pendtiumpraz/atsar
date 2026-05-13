'use client'

/**
 * Sidebar — App shell primary navigation.
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
 *  - Menu data: attempts `/api/v1/me/menu`, else uses seeded-slug fallback.
 *    TODO: integrate full menu API once exposed publicly.
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

// ─── Fallback menu (seeded slugs) ────────────────────────────────────────
// TODO: replace with `/api/v1/me/menu` once available.
const FALLBACK_MENU: MenuItem[] = [
  { slug: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
  {
    slug: 'figures',
    label: 'Tokoh',
    labelAr: 'الشخصيات',
    icon: 'Users',
    path: '/figures',
  },
  { slug: 'timeline', label: 'Timeline', icon: 'Clock', path: '/timeline' },
  { slug: 'map', label: 'Peta', icon: 'Map', path: '/map' },
  { slug: 'battles', label: 'Perang', icon: 'Swords', path: '/battles' },
  { slug: 'quiz', label: 'Quiz', icon: 'GraduationCap', path: '/quiz' },
  { slug: 'chat', label: 'AI Chat', icon: 'Bot', path: '/chat' },
  { slug: 'pdf-builder', label: 'PDF Builder', icon: 'FileText', path: '/pdf-builder' },
  { slug: '__divider__', label: '', icon: '', path: '' },
  { slug: 'settings', label: 'Settings', icon: 'Settings', path: '/settings' },
  { slug: 'billing', label: 'Billing', icon: 'CreditCard', path: '/billing' },
]

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

// ─── Menu fetch hook ─────────────────────────────────────────────────────

function useMenu(): MenuItem[] {
  const [items, setItems] = React.useState<MenuItem[]>(FALLBACK_MENU)
  React.useEffect(() => {
    let cancelled = false
    fetch('/api/v1/me/menu', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const fetched = Array.isArray(data) ? data : data?.items
        if (Array.isArray(fetched) && fetched.length > 0) {
          setItems(fetched as MenuItem[])
        }
      })
      .catch(() => {
        /* keep fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])
  return items
}

// ─── Public component ───────────────────────────────────────────────────

export interface SidebarProps {
  /** Mobile drawer open state (parent-controlled via navbar hamburger). */
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}

export function Sidebar({ mobileOpen = false, onMobileOpenChange }: SidebarProps) {
  const pathname = usePathname() ?? '/'
  const items = useMenu()

  const [collapsed, setCollapsed] = React.useState<boolean>(false)
  const [mounted, setMounted] = React.useState(false)

  // Restore persisted state after hydration to avoid SSR mismatch.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === '1') setCollapsed(true)
    } catch {
      /* localStorage unavailable */
    }
    setMounted(true)
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
        collapsed={mounted ? collapsed : false}
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

export default Sidebar
