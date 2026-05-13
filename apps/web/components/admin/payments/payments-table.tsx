// `<PaymentsTable />` — full payment history with status filter.
//
// Renders ALL payments (pending / confirmed / rejected) — the pending
// approval queue lives in `<PendingPaymentCard />` cards above this table.
// Used on `/admin/payments` under the "Riwayat" section.
//
// This module also exports `<PendingPaymentsGrid />`, a thin client wrapper
// that fetches pending payments and lays them out as approval cards. Both
// live here so they can share the row + envelope types.
//
// All copy is Indonesian (admin surface).

'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileImage, Loader2, XCircle } from 'lucide-react'

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
import { paymentsApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'
import type { ActivateTierOption } from '@/components/admin/subscriptions/activate-dialog'

import { PendingPaymentCard } from './pending-payment-card'
import { ProofViewer } from './proof-viewer'

type PaymentStatus = 'pending' | 'confirmed' | 'rejected'
type PaymentMethod = 'manual_transfer' | 'midtrans' | 'xendit'

interface PaymentRow {
  id: string
  userId: string
  subscriptionId: string | null
  amountIdr: number
  method: PaymentMethod
  reference: string | null
  proofUrl: string | null
  status: PaymentStatus
  confirmedBy: string | null
  confirmedAt: string | null
  createdAt: string
  updatedAt: string
}

// The API helper unwraps the envelope `{ ok, data, meta }` and returns
// `data`. For paginated list endpoints `data` is the array directly, but
// older code paths sometimes nest it under `rows` / `data` again — accept
// any of the three shapes so callers don't have to care.
type PaymentsListResponse = PaymentRow[] | { rows?: PaymentRow[]; data?: PaymentRow[] }

function unwrapRows(value: PaymentsListResponse | undefined): PaymentRow[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (Array.isArray(value.rows)) return value.rows
  if (Array.isArray(value.data)) return value.data
  return []
}

const PER_PAGE = 25

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: 'Menunggu',
  confirmed: 'Disetujui',
  rejected: 'Ditolak',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  manual_transfer: 'Transfer Manual',
  midtrans: 'Midtrans',
  xendit: 'Xendit',
}

const ID_DATE_TIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatIdr(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0'
  return `Rp ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return ID_DATE_TIME.format(date)
}

function shortId(value: string | null | undefined, head = 8): string {
  if (!value) return '—'
  return value.length > head ? `${value.slice(0, head)}…` : value
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === 'confirmed') {
    return (
      <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {STATUS_LABEL.confirmed}
      </Badge>
    )
  }
  if (status === 'rejected') {
    return (
      <Badge className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-950/40 dark:text-rose-300">
        <XCircle className="mr-1 h-3 w-3" />
        {STATUS_LABEL.rejected}
      </Badge>
    )
  }
  return (
    <Badge className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
      {STATUS_LABEL.pending}
    </Badge>
  )
}

export interface PaymentsTableProps {
  /** Optional initial status filter (defaults to "all"). */
  initialStatus?: PaymentStatus | 'all'
}

export function PaymentsTable({ initialStatus = 'all' }: PaymentsTableProps) {
  const [status, setStatus] = React.useState<PaymentStatus | 'all'>(initialStatus)
  const [page, setPage] = React.useState(1)
  const [proofUrl, setProofUrl] = React.useState<string | null>(null)
  const [proofTitle, setProofTitle] = React.useState<string | undefined>(undefined)

  // Reset page when filter changes so the user doesn't end up on an empty
  // page after narrowing the result set.
  React.useEffect(() => {
    setPage(1)
  }, [status])

  // The admin payments API requires a concrete status filter (defaults to
  // 'pending'). For "all" we fall back to three parallel queries so the
  // history view still shows everything in one place.
  const allQuery = useQuery({
    queryKey: ['admin', 'payments', 'all', page],
    queryFn: async () => {
      const [pending, confirmed, rejected] = await Promise.all([
        paymentsApi.admin.list({ status: 'pending', page, perPage: PER_PAGE }),
        paymentsApi.admin.list({ status: 'confirmed', page, perPage: PER_PAGE }),
        paymentsApi.admin.list({ status: 'rejected', page, perPage: PER_PAGE }),
      ])
      const rows = [
        ...unwrapRows(pending as PaymentsListResponse),
        ...unwrapRows(confirmed as PaymentsListResponse),
        ...unwrapRows(rejected as PaymentsListResponse),
      ]
      rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      return rows
    },
    enabled: status === 'all',
    placeholderData: (prev) => prev,
  })

  const filteredQuery = useQuery({
    queryKey: ['admin', 'payments', status, page],
    queryFn: () =>
      paymentsApi.admin.list({
        status: status as PaymentStatus,
        page,
        perPage: PER_PAGE,
      }) as Promise<PaymentsListResponse>,
    enabled: status !== 'all',
    placeholderData: (prev) => prev,
  })

  const isLoading = status === 'all' ? allQuery.isLoading : filteredQuery.isLoading
  const isError = status === 'all' ? allQuery.isError : filteredQuery.isError
  const error = status === 'all' ? allQuery.error : filteredQuery.error
  const data = status === 'all' ? allQuery.data : filteredQuery.data
  const rows: PaymentRow[] = unwrapRows(data as PaymentsListResponse | undefined)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Riwayat Pembayaran</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[rgb(var(--text-muted))]">Status</span>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as PaymentStatus | 'all')}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="pending">Menunggu</SelectItem>
              <SelectItem value="confirmed">Disetujui</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
              <tr>
                <th className="px-4 py-2 font-medium">Dibuat</th>
                <th className="px-4 py-2 font-medium">Pengguna</th>
                <th className="px-4 py-2 font-medium">Nominal</th>
                <th className="px-4 py-2 font-medium">Metode</th>
                <th className="px-4 py-2 font-medium">Referensi</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Diverifikasi</th>
                <th className="px-4 py-2 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <span className="inline-flex items-center gap-2 text-[rgb(var(--text-muted))]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat data pembayaran…
                    </span>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center"
                    style={{ color: 'rgb(var(--danger))' }}
                  >
                    {ApiClientError.is(error)
                      ? error.message
                      : 'Gagal memuat data pembayaran.'}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[rgb(var(--text-muted))]"
                  >
                    Belum ada pembayaran pada filter ini.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[rgb(var(--border))] last:border-b-0 hover:bg-[rgb(var(--bg-elevated))]"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-[rgb(var(--text-muted))]">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs">{shortId(row.userId)}</code>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      {formatIdr(row.amountIdr)}
                    </td>
                    <td className="px-4 py-3 text-[rgb(var(--text-muted))]">
                      {METHOD_LABEL[row.method] ?? row.method}
                    </td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-[rgb(var(--text-muted))]">
                      {row.reference ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[rgb(var(--text-muted))]">
                      {row.confirmedAt ? formatDate(row.confirmedAt) : '—'}
                      {row.confirmedBy ? (
                        <>
                          {' '}
                          · <code>{shortId(row.confirmedBy, 6)}</code>
                        </>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {row.proofUrl ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setProofUrl(row.proofUrl)
                            setProofTitle(
                              `${shortId(row.userId)} · ${formatIdr(row.amountIdr)}`,
                            )
                          }}
                        >
                          <FileImage className="mr-1 h-3.5 w-3.5" />
                          Bukti
                        </Button>
                      ) : (
                        <span className="text-xs text-[rgb(var(--text-muted))]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Lightweight pagination — only renders when we got a full page back,
            since the merged "all" branch doesn't expose a total. */}
        {rows.length >= PER_PAGE && status !== 'all' ? (
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

      <ProofViewer
        open={proofUrl !== null}
        onOpenChange={(open) => {
          if (!open) {
            setProofUrl(null)
            setProofTitle(undefined)
          }
        }}
        url={proofUrl}
        title={proofTitle}
      />
    </Card>
  )
}

// ─── PendingPaymentsGrid ──────────────────────────────────────────────────
// Approval-friendly grid mounted at the top of `/admin/payments`. Lives in
// the same module as `<PaymentsTable />` so they share the row shape + the
// envelope-unwrapping helper.

export interface PendingPaymentsGridProps {
  tiers: ActivateTierOption[]
}

export function PendingPaymentsGrid({ tiers }: PendingPaymentsGridProps) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'payments', 'pending', 1],
    queryFn: () =>
      paymentsApi.admin.list({
        status: 'pending',
        page: 1,
        perPage: 50,
      }) as Promise<PaymentsListResponse>,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
  })

  const rows: PaymentRow[] = unwrapRows(data as PaymentsListResponse | undefined)

  const handleResolved = React.useCallback(() => {
    // Refresh both the pending queue and the audit table so a confirmed/
    // rejected payment drops from the cards AND surfaces in history.
    queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
  }, [queryClient])

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <span className="inline-flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat antrian pembayaran…
          </span>
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm" style={{ color: 'rgb(var(--danger))' }}>
            {ApiClientError.is(error)
              ? error.message
              : 'Gagal memuat antrian pembayaran.'}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Coba lagi
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <p className="text-sm font-medium text-[rgb(var(--text))]">
            Tidak ada pembayaran menunggu verifikasi.
          </p>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Bukti pembayaran baru akan muncul di sini.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
        <span>
          {rows.length} pembayaran menunggu{isFetching ? ' · memuat ulang…' : ''}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Muat ulang'}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <PendingPaymentCard
            key={row.id}
            payment={{
              id: row.id,
              userId: row.userId,
              subscriptionId: row.subscriptionId,
              amountIdr: row.amountIdr,
              method: row.method,
              reference: row.reference,
              proofUrl: row.proofUrl,
              createdAt: row.createdAt,
            }}
            tiers={tiers}
            onResolved={handleResolved}
          />
        ))}
      </div>
    </div>
  )
}
