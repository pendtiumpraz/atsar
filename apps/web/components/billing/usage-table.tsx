'use client'

// UsageTable — paginated table of AI usage rows.
//
// Plain semantic table (no @tanstack/react-table dependency yet — keeps the
// surface area lean for now). Pagination is owned by the parent page since
// the data is fetched server-side via `aiApi.usage`. The table is purely
// presentational + handles the empty state.
//
// Columns: time / role / model / tokens / credits.

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

export interface UsageTableRow {
  id?: string | number
  createdAt?: string | Date | null
  role?: string | null
  model?: string | null
  tokensIn?: number | null
  tokensOut?: number | null
  tokensTotal?: number | null
  credits?: number | null
  creditsUsed?: number | null
}

interface UsageTableProps {
  rows: UsageTableRow[]
  total: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
  loading?: boolean
}

const DT = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const ROLE_LABEL: Record<string, string> = {
  chat: 'chat',
  agent: 'agent',
  doc_analyzer: 'doc_analyzer',
  avatar: 'avatar',
  embedding: 'embedding',
}

function fmtTime(v: UsageTableRow['createdAt']): string {
  if (!v) return '—'
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return '—'
  return DT.format(d)
}

function fmtTokens(row: UsageTableRow): string {
  if (typeof row.tokensTotal === 'number') return row.tokensTotal.toLocaleString('id-ID')
  const i = Number(row.tokensIn ?? 0)
  const o = Number(row.tokensOut ?? 0)
  const t = i + o
  return t > 0 ? t.toLocaleString('id-ID') : '—'
}

function fmtCredits(row: UsageTableRow): string {
  const c = Number(row.credits ?? row.creditsUsed ?? 0)
  return c > 0 ? c.toLocaleString('id-ID') : '—'
}

export function UsageTable({
  rows,
  total,
  page,
  perPage,
  onPageChange,
  loading,
}: UsageTableProps) {
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const start = total === 0 ? 0 : (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-[rgb(var(--border))]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))]">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Waktu</th>
              <th className="px-3 py-2 text-left font-medium">Role</th>
              <th className="px-3 py-2 text-left font-medium">Model</th>
              <th className="px-3 py-2 text-right font-medium">Tokens</th>
              <th className="px-3 py-2 text-right font-medium">Credits</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-[rgb(var(--text-muted))]"
                >
                  Memuat...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-[rgb(var(--text-muted))]"
                >
                  Belum ada penggunaan untuk filter ini.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id ?? idx}
                  className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <td className="px-3 py-2 whitespace-nowrap">{fmtTime(row.createdAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {ROLE_LABEL[row.role ?? ''] ?? row.role ?? '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                    {row.model ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtTokens(row)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {fmtCredits(row)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--text-muted))]">
        <span>
          {start}–{end} dari {total.toLocaleString('id-ID')}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || loading}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>
            {page} / {lastPage}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(lastPage, page + 1))}
            disabled={page >= lastPage || loading}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default UsageTable
