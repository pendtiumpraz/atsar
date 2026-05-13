'use client'

// Subscription tab — current tier, sejak/reset dates, quota usage cards,
// plus action buttons (history / upgrade / kontak admin to cancel).

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { subscriptionsApi } from '@/lib/api/endpoints'

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

// Admin contact — kept inline; later we can promote to a shared constant.
const ADMIN_WA_NUMBER = '6281319504400'
const ADMIN_WA_TEXT = encodeURIComponent(
  'Assalaamu alaikum, saya ingin berhenti langganan Athar.',
)
const ADMIN_WA_URL = `https://wa.me/${ADMIN_WA_NUMBER}?text=${ADMIN_WA_TEXT}`

function fmtDate(value: unknown): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return '—'
  return ID_DATE.format(d)
}

interface QuotaRow {
  label: string
  used: number
  limit: number
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function QuotaBar({ row }: { row: QuotaRow }) {
  const unlimited = row.limit === -1
  const p = unlimited ? 100 : pct(row.used, row.limit)
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{row.label}</span>
        <span className="font-medium">
          {unlimited ? `${row.used} (tanpa batas)` : `${row.used} / ${row.limit}`}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-elevated))]">
        <div
          className="h-full rounded-full bg-[rgb(var(--primary))] transition-[width]"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  )
}

export function SubscriptionTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['subscriptions', 'me'],
    queryFn: () => subscriptionsApi.me(),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-[rgb(var(--text-muted))]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat langganan...
        </CardContent>
      </Card>
    )
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-[rgb(var(--text-muted))]">
          Gagal memuat data langganan.
        </CardContent>
      </Card>
    )
  }

  // Defensive extraction — backend shape may evolve.
  const sub = data as Record<string, unknown>
  const tier =
    (sub.tier as { slug?: string; name?: string } | undefined) ?? {}
  const tierSlug =
    (typeof sub.tierSlug === 'string' && sub.tierSlug) ||
    (typeof tier.slug === 'string' && tier.slug) ||
    'free'
  const tierLabel = TIER_LABEL[tierSlug] ?? tierSlug

  const status = (sub.status as string | undefined) ?? 'active'
  const startedAt = sub.startedAt ?? sub.createdAt ?? null
  const resetAt = sub.quotaResetAt ?? sub.resetAt ?? null
  const expiresAt = sub.expiresAt ?? sub.trialUntil ?? null

  const usage = (sub.usage as Record<string, { used?: number; limit?: number }> | undefined) ?? {}
  const pdf = usage.pdf_download ?? usage.pdf ?? {}
  const chat = usage.ai_chat ?? usage.chat ?? {}

  const quotaRows: QuotaRow[] = [
    {
      label: 'PDF Download',
      used: Number(pdf.used ?? 0),
      limit: Number(pdf.limit ?? 0),
    },
    {
      label: 'AI Chat',
      used: Number(chat.used ?? 0),
      limit: Number(chat.limit ?? 0),
    },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tier Saat Ini</CardTitle>
          <CardDescription>
            Informasi paket langganan dan masa berlaku Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-[rgb(var(--primary))] px-3 py-1 text-xs font-medium text-[rgb(var(--primary-foreground))]">
              {tierLabel}
              {status === 'trial' ? <span className="ml-1 opacity-90">· Trial</span> : null}
            </span>
            <span className="text-xs text-[rgb(var(--text-muted))]">
              Status: {status}
            </span>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                Sejak
              </dt>
              <dd className="mt-0.5 font-medium">{fmtDate(startedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                Reset kuota
              </dt>
              <dd className="mt-0.5 font-medium">{fmtDate(resetAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                Berakhir
              </dt>
              <dd className="mt-0.5 font-medium">{fmtDate(expiresAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Penggunaan Bulan Ini</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quotaRows.map((row) => (
            <QuotaBar key={row.label} row={row} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap gap-3 pt-6">
          <Button asChild variant="outline">
            <Link href="/billing/usage">Lihat history</Link>
          </Button>
          <Button asChild>
            <Link href="/pricing">Upgrade</Link>
          </Button>
          <Button asChild variant="ghost">
            <a href={ADMIN_WA_URL} target="_blank" rel="noopener noreferrer">
              Kontak Admin untuk berhenti
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
