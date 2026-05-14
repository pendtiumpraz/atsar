// `<SubscriptionsTable />` — admin view of every subscription on the platform.
//
// Columns: pengguna, tier, status, periode, dimulai, berakhir, reset kuota.
// Per-row actions: Aktifkan (manual), Expire, Lihat pembayaran (deep-link to
// /admin/payments filtered for that user).
//
// Tier metadata (id + slug + nameId + prices) is loaded by the server page
// and passed in so the activate dialog can render its dropdown without an
// extra round-trip.
//
// All copy is Indonesian (admin surface).

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, TimerOff } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { subscriptionsApi } from '@/lib/api/endpoints'
import { api, ApiClientError } from '@/lib/api/client'
import { confirm as swalConfirm } from '@/lib/swal'

import {
  ActivateDialog,
  type ActivateTierOption,
  type BillingCycle,
} from './activate-dialog'

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled'

interface TierShape {
  id: string
  slug: string
  nameId: string
  priceMonthlyIdr?: number
  priceYearlyIdr?: number
}

interface SubscriptionRow {
  id: string
  userId: string
  tierId: string
  status: SubscriptionStatus
  billingCycle: BillingCycle | null
  startedAt: string | null
  expiresAt: string | null
  trialUntil: string | null
  quotaResetAt: string | null
  autoRenew: boolean
  activatedBy: string | null
  activatedAt: string | null
  notes: string | null
  tier?: TierShape | null
  createdAt: string
}

// The shared API client unwraps the standard envelope and returns the
// `data` field. For paginated list endpoints that's the array directly,
// but be defensive about the shape across the codebase.
type SubscriptionsListResponse =
  | SubscriptionRow[]
  | { rows?: SubscriptionRow[]; data?: SubscriptionRow[] }

function unwrapSubscriptionRows(
  value: SubscriptionsListResponse | undefined,
): SubscriptionRow[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value.rows)) return value.rows
  if (Array.isArray(value.data)) return value.data
  return []
}

const PER_PAGE = 10

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: 'Trial',
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
}

const ID_DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return ID_DATE.format(date)
}

function shortId(value: string | null | undefined, head = 10): string {
  if (!value) return '—'
  return value.length > head ? `${value.slice(0, head)}…` : value
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  if (status === 'active') {
    return (
      <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        {STATUS_LABEL.active}
      </Badge>
    )
  }
  if (status === 'trial') {
    return (
      <Badge className="border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-950/40 dark:text-sky-300">
        {STATUS_LABEL.trial}
      </Badge>
    )
  }
  if (status === 'expired') {
    return (
      <Badge className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
        {STATUS_LABEL.expired}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      {STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export interface SubscriptionsTableProps {
  /** Paid tier catalog for the activate dialog. */
  tiers: ActivateTierOption[]
}

export function SubscriptionsTable({ tiers }: SubscriptionsTableProps) {
  const queryClient = useQueryClient()
  const [status, setStatus] = React.useState<SubscriptionStatus | 'all'>('all')
  const [page, setPage] = React.useState(1)

  const [activateTarget, setActivateTarget] = React.useState<SubscriptionRow | null>(null)

  // Reset to page 1 whenever the filter changes — preserving the page after a
  // narrowing filter usually lands the user on an empty result.
  React.useEffect(() => {
    setPage(1)
  }, [status])

  const queryKey = ['admin', 'subscriptions', status, page] as const
  const query = useQuery({
    queryKey,
    queryFn: () => {
      // `subscriptionsApi.admin.list` was typed for a historical `tier`
      // param, but the route filters on `status`. `buildQuery` accepts any
      // object so we cast through `unknown` to bypass the stale shape.
      const params = {
        page,
        perPage: PER_PAGE,
        ...(status === 'all' ? {} : { status }),
      } as unknown as Parameters<typeof subscriptionsApi.admin.list>[0]
      return subscriptionsApi.admin.list(params) as Promise<SubscriptionsListResponse>
    },
    placeholderData: (prev) => prev,
  })

  const rows: SubscriptionRow[] = React.useMemo(
    () => unwrapSubscriptionRows(query.data as SubscriptionsListResponse | undefined),
    [query.data],
  )

  const refresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
  }, [queryClient])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Daftar Langganan</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[rgb(var(--text-muted))]">Status</span>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SubscriptionStatus | 'all')}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="expired">Kedaluwarsa</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                <tr>
                  <th className="px-4 py-2 font-medium">Pengguna</th>
                  <th className="px-4 py-2 font-medium">Tier</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Periode</th>
                  <th className="px-4 py-2 font-medium">Dimulai</th>
                  <th className="px-4 py-2 font-medium">Berakhir</th>
                  <th className="px-4 py-2 font-medium">Reset Kuota</th>
                  <th className="px-4 py-2 text-right font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center">
                      <span className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat data langganan…
                      </span>
                    </td>
                  </tr>
                ) : query.isError ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center"
                      style={{ color: 'rgb(var(--danger))' }}
                    >
                      {ApiClientError.is(query.error)
                        ? query.error.message
                        : 'Gagal memuat data langganan.'}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-[rgb(var(--text-muted))]"
                    >
                      Belum ada langganan pada filter ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <SubscriptionRowView
                      key={row.id}
                      row={row}
                      onActivate={() => setActivateTarget(row)}
                      onExpired={refresh}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {rows.length >= PER_PAGE ? (
            <div className="flex items-center justify-between border-t border-[rgb(var(--border))] px-4 py-3 text-sm">
              <span className="text-[rgb(var(--text-muted))]">Halaman {page}</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ActivateDialog
        open={activateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setActivateTarget(null)
        }}
        subscriptionId={activateTarget?.id ?? null}
        label={
          activateTarget
            ? `${shortId(activateTarget.userId)} · ${activateTarget.tier?.nameId ?? activateTarget.tierId.slice(0, 8)}`
            : undefined
        }
        defaultTierId={activateTarget?.tierId}
        defaultBillingCycle={activateTarget?.billingCycle ?? 'monthly'}
        tiers={tiers}
        onActivated={refresh}
      />
    </>
  )
}

interface SubscriptionRowViewProps {
  row: SubscriptionRow
  onActivate: () => void
  onExpired: () => void
}

function SubscriptionRowView({ row, onActivate, onExpired }: SubscriptionRowViewProps) {
  const [expiring, setExpiring] = React.useState(false)

  // Expire is exposed via the same PATCH-ish flow as activate: there's no
  // dedicated endpoint, so we use the activate endpoint with the special
  // sentinel of POSTing { tierId, billingCycle } only when we have a row to
  // expire. Today the API doesn't expose expire to admin UI — we let users
  // hit a future endpoint and surface a friendly toast otherwise.
  async function handleExpire() {
    const ok = await swalConfirm({
      title: 'Tandai sebagai kedaluwarsa?',
      text: 'Langganan akan langsung non-aktif. Pengguna harus melakukan pembayaran baru untuk berlangganan kembali.',
      confirmText: 'Tandai Kedaluwarsa',
      cancelText: 'Batal',
      dangerous: true,
    })
    if (!ok) return
    setExpiring(true)
    try {
      // The dedicated expire endpoint is not exposed via the admin REST
      // surface yet — call directly so callers don't have to wait on a
      // follow-up. If the route doesn't exist we surface the underlying 404.
      await api.post(`/admin/subscriptions/${row.id}/expire`, {})
      toast.success('Langganan ditandai kedaluwarsa.')
      onExpired()
    } catch (err) {
      const msg = ApiClientError.is(err) ? err.message : 'Gagal menandai kedaluwarsa.'
      toast.error(msg)
    } finally {
      setExpiring(false)
    }
  }

  const tierLabel =
    row.tier?.nameId ??
    row.tier?.slug ??
    `(tier ${row.tierId.slice(0, 6)})`

  const cycleLabel =
    row.billingCycle === 'yearly'
      ? 'Tahunan'
      : row.billingCycle === 'monthly'
        ? 'Bulanan'
        : '—'

  return (
    <tr className="border-b border-[rgb(var(--border))] last:border-b-0 hover:bg-[rgb(var(--bg-elevated))]">
      <td className="px-4 py-3">
        <code className="text-xs">{shortId(row.userId, 12)}</code>
      </td>
      <td className="px-4 py-3 font-medium">{tierLabel}</td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3 text-[rgb(var(--text-muted))]">{cycleLabel}</td>
      <td className="whitespace-nowrap px-4 py-3 text-[rgb(var(--text-muted))]">
        {formatDate(row.startedAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[rgb(var(--text-muted))]">
        {formatDate(row.expiresAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-[rgb(var(--text-muted))]">
        {formatDate(row.quotaResetAt)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex justify-end gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={onActivate}>
            Aktifkan
          </Button>
          {row.status === 'active' || row.status === 'trial' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExpire}
              disabled={expiring}
              className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              {expiring ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <TimerOff className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Tandai kedaluwarsa</span>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link
              href={`/admin/payments?user=${row.userId}`}
              aria-label="Lihat pembayaran pengguna"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="sr-only">Lihat pembayaran</span>
            </Link>
          </Button>
        </div>
      </td>
    </tr>
  )
}
