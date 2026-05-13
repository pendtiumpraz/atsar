// `/admin/subscriptions` — admin view of every subscription on the platform.
//
// Server component. The `(admin)/layout.tsx` already verifies the session
// and the `admin` role, so this file is purely composition + a tiny pending
// payment count badge that deep-links to `/admin/payments`.
//
// Tier catalog is loaded from the DB here so `<SubscriptionsTable />` and
// `<ActivateDialog />` can render their dropdowns without a separate fetch
// (there's no public `/tiers` endpoint by design — tiers are admin-managed
// catalog data).

import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { payments, tiers } from '@athar/db/schema'

import { Badge } from '@/components/ui/badge'
import { SubscriptionsTable } from '@/components/admin/subscriptions/subscriptions-table'
import type { ActivateTierOption } from '@/components/admin/subscriptions/activate-dialog'

export const metadata: Metadata = {
  title: 'Langganan · Admin · Atsar',
  description: 'Kelola langganan, aktivasi manual, dan masa berlaku akses Atsar.',
}

// The pending count + tier catalog are both DB reads that change frequently
// on the operational hot path. Force dynamic so we always see fresh data.
export const dynamic = 'force-dynamic'

async function loadPendingPaymentCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(and(isNull(payments.deletedAt), eq(payments.status, 'pending')))
    return row?.count ?? 0
  } catch {
    return 0
  }
}

async function loadTiers(): Promise<ActivateTierOption[]> {
  try {
    const rows = await db
      .select({
        id: tiers.id,
        slug: tiers.slug,
        nameId: tiers.nameId,
        priceMonthlyIdr: tiers.priceMonthlyIdr,
        priceYearlyIdr: tiers.priceYearlyIdr,
        displayOrder: tiers.displayOrder,
      })
      .from(tiers)
      .where(and(isNull(tiers.deletedAt), eq(tiers.isActive, true)))
      .orderBy(asc(tiers.displayOrder), asc(tiers.priceMonthlyIdr))

    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      nameId: r.nameId,
      priceMonthlyIdr: r.priceMonthlyIdr,
      priceYearlyIdr: r.priceYearlyIdr,
    }))
  } catch {
    return []
  }
}

export default async function AdminSubscriptionsPage() {
  const [pendingCount, tierList] = await Promise.all([
    loadPendingPaymentCount(),
    loadTiers(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Langganan
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Kelola masa berlaku, paket, dan aktivasi manual langganan pengguna Atsar.
          </p>
        </div>

        <Link
          href="/admin/payments"
          className="inline-flex items-center gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-sm transition-colors hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]"
          aria-label={`${pendingCount} pembayaran menunggu verifikasi`}
        >
          <span className="text-[rgb(var(--text-muted))]">Pembayaran menunggu</span>
          <Badge
            className={
              pendingCount > 0
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))]'
            }
          >
            {pendingCount}
          </Badge>
        </Link>
      </header>

      <SubscriptionsTable tiers={tierList} />
    </div>
  )
}
