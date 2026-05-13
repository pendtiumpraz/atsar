'use client'

/**
 * UserMenu — Navbar avatar dropdown.
 *
 * Spec: docs/UI_UX.md §5.1 — Profile, Billing, Settings, Logout.
 * Data: GET /api/auth/session (better-auth). Falls back to "Akun" if unauthenticated.
 * TODO: replace inline dropdown with `@/components/ui/dropdown-menu` (F1).
 */

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User as UserIcon, CreditCard, Settings } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface SessionUser {
  id: string
  name?: string | null
  email?: string | null
  image?: string | null
}

async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: SessionUser } | SessionUser | null
    if (!data) return null
    if ('user' in (data as { user?: SessionUser })) {
      return (data as { user?: SessionUser }).user ?? null
    }
    return data as SessionUser
  } catch {
    return null
  }
}

function initials(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? '').trim()
  if (!source) return '·'
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const { data: user } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: fetchSession,
    staleTime: 60_000,
  })

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
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      /* ignore */
    }
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
