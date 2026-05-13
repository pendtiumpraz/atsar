'use client'

/**
 * NotificationBell — Navbar unread notifications.
 *
 * Spec: docs/UI_UX.md §5.4 — bell + unread badge + dropdown of latest 10.
 * Data: GET /api/v1/notifications?unreadOnly=true&limit=10 every 30s.
 * TODO: swap inline dropdown for `@/components/ui/dropdown-menu` once F1 ships;
 *       upgrade polling → SSE per WIREFRAMES §31.
 */

import * as React from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

interface NotificationItem {
  id: string
  title: string
  body?: string
  href?: string
  createdAt: string
  readAt?: string | null
}

interface NotificationsResponse {
  items: NotificationItem[]
  unreadCount?: number
}

async function fetchUnread(): Promise<NotificationsResponse> {
  const res = await fetch('/api/v1/notifications?unreadOnly=true&limit=10', {
    credentials: 'include',
  })
  if (!res.ok) return { items: [], unreadCount: 0 }
  const data = (await res.json()) as Partial<NotificationsResponse> & {
    notifications?: NotificationItem[]
    total?: number
  }
  const items = data.items ?? data.notifications ?? []
  return {
    items,
    unreadCount:
      typeof data.unreadCount === 'number'
        ? data.unreadCount
        : (data.total ?? items.length),
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.round(hr / 24)
  return `${day} hari lalu`
}

export function NotificationBell() {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement | null>(null)

  const { data } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnread,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 15_000,
  })

  const count = data?.unreadCount ?? 0
  const items = data?.items ?? []

  // Click-outside + Escape
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifikasi${count > 0 ? `, ${count} belum dibaca` : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-md',
          'text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
        )}
      >
        <Bell className="h-5 w-5 text-[rgb(var(--sidebar-icon))]" />
        {count > 0 && (
          <span
            aria-hidden
            className={cn(
              'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1',
              'rounded-full bg-[rgb(var(--danger))] text-white',
              'text-[10px] font-semibold leading-[18px] text-center',
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifikasi terbaru"
          className={cn(
            'absolute right-0 top-full mt-2 z-[500] w-80',
            'rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
            'shadow-lg overflow-hidden',
          )}
        >
          <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-3 py-2">
            <span className="text-sm font-semibold">Notifikasi</span>
            <span className="text-xs text-[rgb(var(--text-muted))]">
              {count} belum dibaca
            </span>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-[rgb(var(--text-muted))]">
                Tidak ada notifikasi baru.
              </li>
            )}
            {items.map((n) => {
              const content = (
                <>
                  <p className="text-sm font-medium text-[rgb(var(--text))]">
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[rgb(var(--text-muted))]">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-[rgb(var(--text-faint))]">
                    {timeAgo(n.createdAt)}
                  </p>
                </>
              )
              return (
                <li
                  key={n.id}
                  className="border-b border-[rgb(var(--border))] last:border-b-0"
                >
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2 hover:bg-[rgb(var(--bg-elevated))]"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="px-3 py-2">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="border-t border-[rgb(var(--border))]">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-center text-xs font-medium text-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]"
            >
              Lihat semua →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
