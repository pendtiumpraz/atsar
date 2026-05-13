'use client'

/**
 * NotificationList — full-page list rendered at `/notifications`.
 *
 * Spec: WIREFRAMES §31.
 *   - Right-aligned "Tandai semua dibaca" button.
 *   - Items grouped by recency bucket: Hari ini / Kemarin / Minggu ini /
 *     Lebih lama.
 *   - Each row → `<NotificationItem />`.
 *   - Friendly empty state when nothing matches.
 */

import * as React from 'react'
import dayjs from 'dayjs'
import isToday from 'dayjs/plugin/isToday'
import isYesterday from 'dayjs/plugin/isYesterday'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import { CheckCheck, Inbox } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useNotifications, type NotificationRow } from '@/hooks/use-notifications'

import { NotificationItem } from './notification-item'

dayjs.extend(isToday)
dayjs.extend(isYesterday)
dayjs.extend(isSameOrAfter)

type BucketKey = 'today' | 'yesterday' | 'week' | 'older'

const BUCKET_LABEL: Record<BucketKey, string> = {
  today: 'Hari ini',
  yesterday: 'Kemarin',
  week: 'Minggu ini',
  older: 'Lebih lama',
}

const BUCKET_ORDER: BucketKey[] = ['today', 'yesterday', 'week', 'older']

function bucketFor(iso: string): BucketKey {
  const d = dayjs(iso)
  if (d.isToday()) return 'today'
  if (d.isYesterday()) return 'yesterday'
  // "Minggu ini" = within the last 7 days (and not today/yesterday).
  if (d.isSameOrAfter(dayjs().subtract(7, 'day'))) return 'week'
  return 'older'
}

function groupByBucket(items: NotificationRow[]): Record<BucketKey, NotificationRow[]> {
  const groups: Record<BucketKey, NotificationRow[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  }
  for (const item of items) groups[bucketFor(item.createdAt)].push(item)
  return groups
}

export function NotificationList() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    error,
    markRead,
    isMarkingRead,
    markAllRead,
    isMarkingAllRead,
  } = useNotifications()

  const groups = React.useMemo(() => groupByBucket(notifications), [notifications])

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[rgb(var(--text-muted))]">
          {isLoading
            ? 'Memuat…'
            : unreadCount > 0
              ? `${unreadCount} belum dibaca`
              : 'Semua sudah dibaca'}
        </p>
        <button
          type="button"
          onClick={() => markAllRead()}
          disabled={isMarkingAllRead || unreadCount === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium',
            'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text))]',
            'hover:bg-[rgb(var(--bg-elevated))]',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          Tandai semua dibaca
        </button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-md border border-[rgb(var(--danger)/0.4)] bg-[rgb(var(--danger)/0.08)] px-3 py-2 text-sm text-[rgb(var(--danger))]"
        >
          Gagal memuat notifikasi: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      )}

      {isLoading && notifications.length === 0 ? (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
            />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-6 py-12 text-center">
          <Inbox className="h-8 w-8 text-[rgb(var(--text-faint))]" aria-hidden />
          <p className="text-sm font-medium text-[rgb(var(--text))]">
            Belum ada notifikasi.
          </p>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Pembaruan akan muncul di sini saat ada aktivitas baru.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {BUCKET_ORDER.map((bucket) => {
            const rows = groups[bucket]
            if (rows.length === 0) return null
            return (
              <div key={bucket}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
                  {BUCKET_LABEL[bucket]}
                </h2>
                <ul className="space-y-2">
                  {rows.map((n) => (
                    <li key={n.id}>
                      <NotificationItem
                        notification={n}
                        onMarkRead={markRead}
                        isMarkingRead={isMarkingRead}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default NotificationList
