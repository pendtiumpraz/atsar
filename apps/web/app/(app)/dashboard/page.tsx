// Subscriber dashboard — `/dashboard`.
//
// Server component. The `(app)` layout already verifies session + active
// subscription, so we can assume `userId` is present and `getActiveSubscription`
// returns a usable plan. We still defend against `null` for type-safety
// (the layout could change without notice).
//
// Data fetched in parallel (Promise.all):
//   - active subscription (with tier)
//   - PDF download quota for the current period
//   - AI chat quota for the current period
//   - subscription row (for `quotaResetAt` + `trialUntil`)
//
// Out of scope for Phase 4 (TODO when endpoints land):
//   - Recent figures viewed → falls back to "Akses Cepat" static grid.
//   - Konten Baru feed       → static placeholder.
//   - Pengumuman panel       → static placeholder.

import { headers } from 'next/headers'
import Link from 'next/link'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { subscriptions } from '@athar/db/schema'
import { TRIAL_DAYS } from '@athar/shared'

import { LanjutBelajar } from '@/components/dashboard/lanjut-belajar'
import { QuickAccess } from '@/components/dashboard/quick-access'
import { QuotaCard } from '@/components/dashboard/quota-card'
import { auth, getActiveSubscription } from '@/lib/server/auth'
import {
  ensureQuota,
  type QuotaStatus,
} from '@/lib/server/services/quota.service'

const ID_DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  sampler: 'Sampler',
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
}

/** Safe wrapper — quota.ensureQuota throws on QUOTA_EXCEEDED. We catch and
 *  surface a "100% used" status so the card still renders. */
async function readQuota(
  userId: string,
  type: 'pdf_download' | 'ai_chat',
): Promise<QuotaStatus | null> {
  try {
    return await ensureQuota(userId, type)
  } catch {
    // Likely QUOTA_EXCEEDED or no subscription. The dashboard should not
    // crash — render as "exhausted" instead.
    return null
  }
}

/** Days remaining on the user's trial, or 0 if they are not in trial. */
function trialDaysRemaining(trialUntil: Date | null): number {
  if (!trialUntil) return 0
  const ms = trialUntil.getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export default async function DashboardPage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id
  // Layout already redirected if userId/sub missing; this is a typeguard.
  if (!userId) return null

  const userName = session?.user?.name ?? 'kawan'

  const [active, subRow, pdfQuota, aiQuota] = await Promise.all([
    getActiveSubscription(userId),
    db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, userId), isNull(subscriptions.deletedAt)),
      orderBy: [desc(subscriptions.createdAt)],
    }),
    readQuota(userId, 'pdf_download'),
    readQuota(userId, 'ai_chat'),
  ])

  // Layout guarantees `active`, but TypeScript needs the narrow.
  const tierName = active ? TIER_LABEL[active.tierSlug] ?? active.tierSlug : '—'
  const resetAt = subRow?.quotaResetAt ?? null
  const expiresAt = active?.expiresAt ?? null
  const isTrial = active?.status === 'trial'
  const trialUntil = subRow?.trialUntil ?? null
  const trialRemaining = trialDaysRemaining(trialUntil)
  const trialUsed = Math.max(0, TRIAL_DAYS - trialRemaining)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Greeting */}
      <header className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Selamat datang, {userName}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary))] px-3 py-1 text-xs font-medium text-[rgb(var(--primary-foreground))]">
            {tierName}
            {isTrial ? <span className="opacity-90">· Trial</span> : null}
          </span>
          {expiresAt ? (
            <span className="text-xs text-[rgb(var(--text-muted))]">
              Berakhir: {ID_DATE.format(expiresAt)}
            </span>
          ) : null}
          {resetAt ? (
            <span className="text-xs text-[rgb(var(--text-muted))]">
              · Reset kuota: {ID_DATE.format(resetAt)}
            </span>
          ) : null}
        </div>
      </header>

      {/* Quota cards */}
      <section
        aria-label="Penggunaan kuota"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
        <QuotaCard
          kind="trial"
          label="Trial"
          used={trialUsed}
          limit={isTrial ? TRIAL_DAYS : 0}
          footer={
            trialUntil && isTrial
              ? `Berakhir ${ID_DATE.format(trialUntil)}`
              : undefined
          }
        />
      </section>

      {/* Lanjut Belajar + Akses Cepat */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* TODO: wire to read-tracking endpoint when available. */}
        <LanjutBelajar items={[]} />
        <QuickAccess />
      </section>

      {/* Konten Baru + Pengumuman (stubs) */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <KontenBaruPanel />
        <PengumumanPanel />
      </section>
    </div>
  )
}

function KontenBaruPanel() {
  return (
    <section
      aria-labelledby="konten-baru-heading"
      className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
    >
      <header className="flex items-center justify-between">
        <h2
          id="konten-baru-heading"
          className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
        >
          Konten Baru
        </h2>
        <Link
          href="/figures"
          className="text-xs text-[rgb(var(--accent))] hover:underline"
        >
          Semua →
        </Link>
      </header>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-[rgb(var(--text-muted))]">
          Belum ada konten baru pekan ini.
        </li>
      </ul>
    </section>
  )
}

function PengumumanPanel() {
  return (
    <section
      aria-labelledby="pengumuman-heading"
      className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
    >
      <header>
        <h2
          id="pengumuman-heading"
          className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
        >
          Pengumuman
        </h2>
      </header>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-[rgb(var(--text-muted))]">
          Tidak ada pengumuman saat ini.
        </li>
      </ul>
    </section>
  )
}
