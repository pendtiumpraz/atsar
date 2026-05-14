'use client'

/**
 * UserMenu — Navbar avatar dropdown.
 *
 * Spec: docs/UI_UX.md §5.1 — Profile, Billing, Settings, Logout.
 *
 * Data sources:
 *  - `useSession()` from better-auth (typed; reads `/api/auth/get-session`)
 *    for the authenticated user.
 *  - `getMyRoleSlugs()` server action to decide whether to show the
 *    "Admin Panel" entry — better-auth's session payload doesn't include
 *    role info, and we don't want to leak that to anonymous callers.
 *
 * Sign-out uses `authClient.signOut()` so both the cookie-cache and the
 * React Query cache get invalidated (raw fetch to `/api/auth/sign-out`
 * leaves the better-auth client out of sync).
 *
 * TODO: replace inline dropdown with `@/components/ui/dropdown-menu` (F1).
 */

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  LogOut,
  User as UserIcon,
  CreditCard,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { authClient, useSession } from '@/lib/auth-client'
import { getMyRoleSlugs } from '@/lib/server/auth/get-role-slugs'

function initials(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? '').trim()
  if (!source) return '·'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  // Typed better-auth session hook — hits the correct `/api/auth/get-session`
  // endpoint and integrates with the better-auth client cache.
  const { data: session } = useSession()
  const user = session?.user ?? null

  // Resolve role slugs only when we actually have a session — anonymous
  // visitors don't need this round-trip. The 5-minute staleTime mirrors the
  // Redis cache TTL in `getEffectivePermissions`, so we don't hammer the DB
  // when the user opens/closes the menu repeatedly.
  const { data: roleSlugs = [] } = useQuery({
    queryKey: ['auth', 'role-slugs', user?.id ?? null],
    queryFn: () => getMyRoleSlugs(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })
  const isAdmin = roleSlugs.includes('admin')

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function onLogout() {
    setOpen(false)
    try {
      // Use the typed client so better-auth's cookie cache + observers are
      // both invalidated. A raw `fetch('/api/auth/sign-out')` would leave
      // `useSession()` returning stale data until the next refresh.
      await authClient.signOut()
    } catch {
      /* ignore — we still want to navigate to /login */
    }
    // Drop any cached auth/role queries so the next render starts clean.
    queryClient.removeQueries({ queryKey: ['auth'] })
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu pengguna"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full',
          'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text))]',
          'hover:bg-[rgb(var(--border))] overflow-hidden',
        )}
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar URLs may be external; next/image not required here
          <img
            src={user.image}
            alt={user.name ?? 'avatar'}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs font-semibold">
            {initials(user?.name, user?.email)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full mt-2 z-[500] w-60',
            'rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
            'shadow-lg overflow-hidden',
          )}
        >
          <div className="border-b border-[rgb(var(--border))] px-3 py-2">
            <p className="truncate text-sm font-semibold text-[rgb(var(--text))]">
              {user?.name ?? 'Tamu'}
            </p>
            {user?.email && (
              <p className="truncate text-xs text-[rgb(var(--text-muted))]">
                {user.email}
              </p>
            )}
          </div>
          <ul className="py-1 text-sm">
            {isAdmin && (
              <li>
                <Link
                  href="/admin/dashboard"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <ShieldCheck className="h-4 w-4 text-[rgb(var(--accent))]" />
                  Admin Panel
                </Link>
              </li>
            )}
            <li>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 hover:bg-[rgb(var(--bg-elevated))]"
              >
                <UserIcon className="h-4 w-4 text-[rgb(var(--sidebar-icon))]" />
                Profile
              </Link>
            </li>
            <li>
              <Link
                href="/billing"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 hover:bg-[rgb(var(--bg-elevated))]"
              >
                <CreditCard className="h-4 w-4 text-[rgb(var(--sidebar-icon))]" />
                Billing
              </Link>
            </li>
            <li>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 hover:bg-[rgb(var(--bg-elevated))]"
              >
                <Settings className="h-4 w-4 text-[rgb(var(--sidebar-icon))]" />
                Settings
              </Link>
            </li>
          </ul>
          <div className="border-t border-[rgb(var(--border))]">
            <button
              type="button"
              role="menuitem"
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--danger))] hover:bg-[rgb(var(--bg-elevated))]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserMenu
