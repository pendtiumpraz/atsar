// Notifications panel — `/notifications`.
//
// Spec: WIREFRAMES §31. Server component; the (app) layout already enforces
// auth + active subscription so we just render the header and let the client
// `<NotificationList />` fetch + subscribe.

import type { Metadata } from 'next'

import { NotificationList } from '@/components/notifications/notification-list'

export const metadata: Metadata = {
  title: 'Notifikasi',
}

export default function NotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--text))]">
          Notifikasi
        </h1>
        <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">
          Aktivitas terbaru pada akunmu — pembaruan PDF, langganan, dan review.
        </p>
      </header>

      <NotificationList />
    </div>
  )
}
