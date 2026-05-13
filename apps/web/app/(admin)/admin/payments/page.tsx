// `/admin/payments` — manual payment approval workflow.
//
// Server component. Loads the tier catalog from the DB and renders two
// sections:
//   1. "Menunggu Verifikasi" — grid of `<PendingPaymentCard />` so an admin
//      can approve in one click.
//   2. "Riwayat" — full `<PaymentsTable />` with status filter for audit.
//
// Tier data is passed to both client subtrees so they don't have to make
// extra round-trips. `(admin)/layout.tsx` already enforces the admin role.

import type { Metadata } from 'next'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { tiers } from '@athar/db/schema'

import { PaymentsTable } from '@/components/admin/payments/payments-table'
import { PendingPaymentsGrid } from '@/components/admin/payments/payments-table'
import type { ActivateTierOption } from '@/components/admin/subscriptions/activate-dialog'

export const metadata: Metadata = {
  title: 'Pembayaran · Admin · Atsar',
  description: 'Verifikasi bukti pembayaran dan aktivasi langganan secara manual.',
}

export const dynamic = 'force-dynamic'

async function loadTiers(): Promise<ActivateTierOption[]> {
  try {
    const rows = await db
      .select({
        id: tiers.id,
        slug: tiers.slug,
        nameId: tiers.nameId,
        priceMonthlyIdr: tiers.priceMonthlyIdr,
        priceYearlyIdr: tiers.priceYearlyIdr,
      })
      .from(tiers)
      .where(and(isNull(tiers.deletedAt), eq(tiers.isActive, true)))
      .orderBy(asc(tiers.displayOrder), asc(tiers.priceMonthlyIdr))

    return rows
  } catch {
    return []
  }
}

export default async function AdminPaymentsPage() {
  const tierList = await loadTiers()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Pembayaran
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Verifikasi bukti transfer pengguna. Setelah disetujui, langganan akan otomatis
          diaktifkan. Hubungi pengguna via WhatsApp Galih (0813-1950-4441) jika perlu.
        </p>
      </header>

      {/* Pending queue — fast approval grid at the top */}
      <section aria-label="Pembayaran menunggu verifikasi" className="space-y-3">
        <h2
          className="text-lg font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Menunggu Verifikasi
        </h2>
        <PendingPaymentsGrid tiers={tierList} />
      </section>

      {/* History — full audit table */}
      <section aria-label="Riwayat pembayaran" className="space-y-3">
        <h2
          className="text-lg font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Riwayat
        </h2>
        <PaymentsTable initialStatus="all" />
      </section>
    </div>
  )
}
