// Billing overview — `/billing`
//
// Server component. Shows the user's current tier card and quota usage,
// plus shortcut links to the AI usage history and the payment form.
//
// Auth + subscription gates handled by `(app)/layout.tsx`. We still defend
// against the edge cases (no session row / unusable plan) to keep the page
// renderable even when the underlying state is messy.

import { headers } from 'next/headers'
import Link from 'next/link'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { subscriptions } from '@athar/db/schema'
import { ArrowRight, BarChart3, CreditCard } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QuotaCard } from '@/components/dashboard/quota-card'
import { auth, getActiveSubscription } from '@/lib/server/auth'
import { ensureQuota, type QuotaStatus } from '@/lib/server/services/quota.service'

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  sampler: 'Sampler',
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
}

const ID_DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

async function readQuota(
  userId: string,
  type: 'pdf_download' | 'ai_chat',
): Promise<QuotaStatus | null> {
  try {
    return await ensureQuota(userId, type)
  } catch {
    return null
  }
}

export default async function BillingPage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id
  if (!userId) return null

  const [active, subRow, pdfQuota, aiQuota] = await Promise.all([
    getActiveSubscription(userId),
    db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), isNull(subscriptions.deletedAt)),
      orderBy: [desc(subscriptions.createdAt)],
    }),
    readQuota(userId, 'pdf_download'),
    readQuota(userId, 'ai_chat'),
  ])

  const tierName = active ? TIER_LABEL[active.tierSlug] ?? active.tierSlug : '—'
  const status = active?.status ?? 'expired'
  const expiresAt = active?.expiresAt ?? null
  const resetAt = subRow?.quotaResetAt ?? null

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Tagihan & Langganan
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Pantau paket aktif, penggunaan kuota, dan riwayat pembayaran.
        </p>
      </header>

      {/* Tier card */}
      <Card>
        <CardHeader>
          <CardTitle>Paket Aktif</CardTitle>
          <CardDescription>
            Status dan masa berlaku langganan Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-[rgb(var(--primary))] px-3 py-1 text-sm font-medium text-[rgb(var(--primary-foreground))]">
              {tierName}
              {status === 'trial' ? <span className="ml-1 opacity-90">· Trial</span> : null}
            </span>
            {expiresAt ? (
              <span className="text-xs text-[rgb(var(--text-muted))]">
                Berakhir {ID_DATE.format(expiresAt)}
              </span>
            ) : null}
            {resetAt ? (
              <span className="text-xs text-[rgb(var(--text-muted))]">
                · Reset kuota {ID_DATE.format(resetAt)}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Quota usage */}
      <section
        aria-label="Kuota saat ini"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <QuotaCard
          kind="pdf"
          label="PDF Download"
          used={pdfQuota?.used ?? 0}
          limit={pdfQuota?.limit ?? 0}
          footer={resetAt ? `Reset ${ID_DATE.format(resetAt)}` : undefined}
        />
        <QuotaCard
          kind="ai_chat"
          label="AI Chat"
          used={aiQuota?.used ?? 0}
          limit={aiQuota?.limit ?? 0}
          footer={resetAt ? `Reset ${ID_DATE.format(resetAt)}` : undefined}
        />
      </section>

      {/* Shortcuts */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <BarChart3 className="h-5 w-5 text-[rgb(var(--accent))]" />
            <div>
              <CardTitle className="text-base">Riwayat AI Usage</CardTitle>
              <CardDescription>
                Detail panggilan AI per role dan model.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/billing/usage" className="inline-flex items-center gap-2">
                Lihat detail <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <CreditCard className="h-5 w-5 text-[rgb(var(--accent))]" />
            <div>
              <CardTitle className="text-base">Pembayaran</CardTitle>
              <CardDescription>
                Upload bukti transfer untuk aktivasi langganan.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/billing/payment" className="inline-flex items-center gap-2">
                Bayar / aktivasi <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
