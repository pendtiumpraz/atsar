'use client'

/**
 * NotificationItem — single row inside `<NotificationList />`.
 *
 * Spec: WIREFRAMES §31 — type-aware icon, title, body, time ago, and a
 * "Tandai dibaca" affordance for unread rows.  Clicking the row navigates
 * to `actionUrl` when present (and auto-marks the notification as read).
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCircle,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  type LucideIcon,
} from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/id'

import { cn } from '@/lib/utils'
import type { NotificationRow } from '@/hooks/use-notifications'

dayjs.extend(relativeTime)
dayjs.locale('id')

const ICON_BY_TYPE: Record<string, LucideIcon> = {
  pdf_ready: FileText,
  subscription_expiring: Clock,
  review_assigned: ClipboardList,
  content_approved: CheckCircle,
  payment_confirmed: CreditCard,
}

function iconFor(type: string): LucideIcon {
  return ICON_BY_TYPE[type] ?? Bell
}

interface NotificationItemProps {
  notification: NotificationRow
  onMarkRead: (id: string) => void
  isMarkingRead?: boolean
}

export function NotificationItem({
  notification,
  onMarkRead,
  isMarkingRead,
}: NotificationItemProps) {
  const router = useRouter()
  const Icon = iconFor(notification.type)
  const isUnread = !notification.isRead

  const handleNavigate = React.useCallback(() => {
    if (notification.actionUrl) {
      if (isUnread) onMarkRead(notification.id)
      router.push(notification.actionUrl)
    }
  }, [isUnread, notification.actionUrl, notification.id, onMarkRead, router])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!notification.actionUrl) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleNavigate()
    }
  }

  const handleMarkReadClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onMarkRead(notification.id)
  }

  const clickable = Boolean(notification.actionUrl)

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleNavigate : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      className={cn(
        'group flex items-start gap-3 rounded-md border px-3 py-3 transition-colors',
        'border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
        clickable && 'cursor-pointer hover:bg-[rgb(var(--bg-elevated))]',
        isUnread && 'border-l-2 border-l-[rgb(var(--accent))]',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUnread
            ? 'bg-[rgb(var(--accent)/0.12)] text-[rgb(var(--accent))]'
            : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))]',
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p
            className={cn(
              'truncate text-sm',
              isUnread
                ? 'font-semibold text-[rgb(var(--text))]'
                : 'font-medium text-[rgb(var(--text))]',
            )}
          >
            {notification.title ?? 'Notifikasi'}
          </p>
          <time
            dateTime={notification.createdAt}
            className="shrink-0 text-[11px] text-[rgb(var(--text-faint))]"
          >
            {dayjs(notification.createdAt).fromNow()}
          </time>
        </div>

        {notification.body && (
          <p className="mt-1 line-clamp-3 text-sm text-[rgb(var(--text-muted))]">
            {notification.body}
          </p>
        )}

        {isUnread && (
          <div className="mt-2">
            <button
              type="button"
              onClick={handleMarkReadClick}
              disabled={isMarkingRead}
              className={cn(
                'text-xs font-medium text-[rgb(var(--accent))] hover:underline',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Tandai dibaca
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default NotificationItem
