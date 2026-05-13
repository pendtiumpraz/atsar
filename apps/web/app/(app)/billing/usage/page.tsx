'use client'

// Billing → AI Usage history — `/billing/usage`.
//
// Client component. Fetches the paginated usage feed via `aiApi.usage` and
// renders three sections: summary cards, the Recharts bar chart, and the
// paginated table. Filters: date range + role select.

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UsageChart, type UsageRole } from '@/components/billing/usage-chart'
import { UsageTable, type UsageTableRow } from '@/components/billing/usage-table'
import { aiApi, type AiUsageParams } from '@/lib/api/endpoints'

const PER_PAGE = 20

interface UsageResponse {
  rows?: UsageTableRow[]
  total?: number
  summary?: {
    totalCredits?: number
    totalCalls?: number
    totalTokens?: number
  }
  period?: { from?: string; to?: string }
}

function todayIso(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function isoOffsetDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function BillingUsagePage() {
  const [from, setFrom] = React.useState<string>(isoOffsetDays(30))
  const [to, setTo] = React.useState<string>(todayIso())
  const [role, setRole] = React.useState<UsageRole | 'all'>('all')
  const [page, setPage] = React.useState(1)

  const params: AiUsageParams = React.useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      role: role === 'all' ? undefined : role,
      page,
      perPage: PER_PAGE,
    }),
    [from, to, role, page],
  )

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['ai', 'usage', params],
    queryFn: () => aiApi.usage(params) as Promise<UsageResponse>,
    placeholderData: (prev) => prev,
  })

  // Reset page when filters change.
  React.useEffect(() => {
    setPage(1)
  }, [from, to, role])

  const rows = data?.rows ?? []
  const total = Number(data?.total ?? 0)
  const totalCredits = Number(data?.summary?.totalCredits ?? 0)
  const totalCalls = Number(data?.summary?.totalCalls ?? total)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Penggunaan AI
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Periode: {from || '—'} sampai {to || '—'}
        </p>
      </header>

      {/* Filters */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 pt-6 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="from">Dari</Label>
            <Input
              id="from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">Sampai</Label>
            <Input
              id="to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UsageRole | 'all')}
            >
              <SelectTrigger id="role">
                <SelectValue placeholder="Semua role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="doc_analyzer">Doc Analyzer</SelectItem>
                <SelectItem value="avatar">Avatar</SelectItem>
                <SelectItem value="embedding">Embedding</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-[rgb(var(--text-muted))]">
              Total Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-semibold"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              {totalCredits.toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-wide text-[rgb(var(--text-muted))]">
              Total Panggilan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className="text-3xl font-semibold"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              {totalCalls.toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Distribusi Credits per Role</CardTitle>
        </CardHeader>
        <CardContent>
          {isError ? (
            <div className="flex h-72 items-center justify-center text-sm text-[rgb(var(--danger))]">
              Gagal memuat data.{' '}
              <button onClick={() => void refetch()} className="underline">
                Coba lagi
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex h-72 items-center justify-center gap-2 text-sm text-[rgb(var(--text-muted))]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat...
            </div>
          ) : (
            <UsageChart rows={rows} />
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Panggilan</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageTable
            rows={rows}
            total={total}
            page={page}
            perPage={PER_PAGE}
            onPageChange={setPage}
            loading={isLoading || isFetching}
          />
        </CardContent>
      </Card>
    </div>
  )
}
