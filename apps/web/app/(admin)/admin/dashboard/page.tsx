// Dashboard Admin Atsar — `/admin/dashboard`.
//
// Server component. Layout `(admin)/layout.tsx` sudah mem-verify session +
// role `admin`, jadi halaman ini hanya fokus pada agregasi count untuk
// 6 metrik utama platform.
//
// Setiap count di-fetch paralel via `Promise.all`. Tiap query dibungkus
// `safeCount()` agar kegagalan satu tabel (mis. tabel belum ada di env dev)
// tidak menjatuhkan seluruh dashboard — fallback ke 0.

import { and, eq, isNull, sql } from 'drizzle-orm'
import { Users, CreditCard, FileSearch, BookOpen, Swords, Wallet } from 'lucide-react'

import { AdminQuickActions } from '@/components/admin/admin-quick-actions'
import { MetricCard } from '@/components/admin/metric-card'
import { db } from '@athar/db'
import {
  battles,
  figures,
  payments,
  reviewAssignments,
  subscriptions,
  users,
} from '@athar/db/schema'

// `count()` ada di drizzle-orm >= 0.31. Versi paket di repo 0.45 — aman.
// Tetap pakai `sql<number>` template sebagai fallback portable bila API
// `count()` berubah di rilis berikutnya.
const countExpr = sql<number>`count(*)::int`

/**
 * Membungkus query count agar exception (mis. tabel belum migrate, koneksi
 * timeout) tidak menggagalkan halaman. Kembalikan 0 dan log ke console
 * untuk visibility di Vercel logs.
 */
async function safeCount(
  label: string,
  fn: () => Promise<Array<{ count: number }>>,
): Promise<number> {
  try {
    const rows = await fn()
    return rows[0]?.count ?? 0
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[admin/dashboard] gagal hitung ${label}:`, err)
    return 0
  }
}

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const [
    totalUsers,
    activeSubs,
    pendingReviews,
    publishedFigures,
    publishedBattles,
    pendingPayments,
  ] = await Promise.all([
    safeCount('users', () =>
      db.select({ count: countExpr }).from(users).where(isNull(users.deletedAt)),
    ),
    safeCount('subscriptions.active', () =>
      db
        .select({ count: countExpr })
        .from(subscriptions)
        .where(and(eq(subscriptions.status, 'active'), isNull(subscriptions.deletedAt))),
    ),
    safeCount('reviewAssignments.pending', () =>
      db
        .select({ count: countExpr })
        .from(reviewAssignments)
        .where(
          and(eq(reviewAssignments.status, 'pending'), isNull(reviewAssignments.deletedAt)),
        ),
    ),
    safeCount('figures.published', () =>
      db
        .select({ count: countExpr })
        .from(figures)
        .where(and(eq(figures.status, 'published'), isNull(figures.deletedAt))),
    ),
    safeCount('battles.published', () =>
      db
        .select({ count: countExpr })
        .from(battles)
        .where(and(eq(battles.status, 'published'), isNull(battles.deletedAt))),
    ),
    safeCount('payments.pending', () =>
      db
        .select({ count: countExpr })
        .from(payments)
        .where(and(eq(payments.status, 'pending'), isNull(payments.deletedAt))),
    ),
  ])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Dashboard Admin
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Ringkasan operasional platform Atsar.
        </p>
      </header>

      <section
        aria-label="Metrik utama"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <MetricCard
          label="Total User"
          value={totalUsers}
          icon={Users}
          hint="Pengguna aktif (belum dihapus)."
          href="/admin/users"
        />
        <MetricCard
          label="Langganan Aktif"
          value={activeSubs}
          icon={CreditCard}
          hint="Status: active."
          href="/admin/users"
          tone="success"
        />
        <MetricCard
          label="Review Pending"
          value={pendingReviews}
          icon={FileSearch}
          hint="Menunggu keputusan reviewer."
          href="/admin/audit-logs"
          tone={pendingReviews > 0 ? 'warn' : 'default'}
        />
        <MetricCard
          label="Figur Terbit"
          value={publishedFigures}
          icon={BookOpen}
          hint="Status: published."
          href="/admin/audit-logs"
        />
        <MetricCard
          label="Peristiwa Terbit"
          value={publishedBattles}
          icon={Swords}
          hint="Status: published."
          href="/admin/audit-logs"
        />
        <MetricCard
          label="Pembayaran Pending"
          value={pendingPayments}
          icon={Wallet}
          hint="Menunggu konfirmasi admin."
          href="/admin/payments"
          tone={pendingPayments > 0 ? 'warn' : 'default'}
        />
      </section>

      <AdminQuickActions pendingPayments={pendingPayments} />
    </div>
  )
}
