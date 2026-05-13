// Paginated audit-log table for `/admin/audit-logs`.
//
// - Reads filter + page state from the URL (`useSearchParams`) so it stays
//   in sync with `<AuditFilters />`. Page changes patch the URL too — the
//   URL is the single source of truth.
// - Fetches via TanStack Query against `/admin/audit-logs` with
//   `keepPreviousData` so pagination feels instant.
// - Clicking a row opens `<DiffModal />` for the full record (re-fetches
//   the single entry by id — the list response already carries enough to
//   render the row, but the modal expects the canonical entity).
// - Actor column: the list API doesn't (yet) join `users`, so we show the
//   raw UUID with a "system" fallback when null. TODO: enrich server-side
//   with a `users` join so we can show display names + roles directly.

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { adminApi, type Paginated } from '@/lib/api/endpoints'

import { DiffModal } from './diff-modal'

/** Shape returned by `GET /api/v1/admin/audit-logs`. */
export interface AuditLogRow {
  id: string
  actorId: string | null
  actorRole:
    | 'admin'
    | 'reviewer'
    | 'subscriber'
    | 'system'
    | null
  action: string
  resourceType: string | null
  resourceId: string | null
  diff: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

const ROLE_LABEL: Record<NonNullable<AuditLogRow['actorRole']>, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  subscriber: 'Pelanggan',
  system: 'Sistem',
}

const ROLE_VARIANT: Record<
  NonNullable<AuditLogRow['actorRole']>,
  'default' | 'secondary' | 'outline' | 'accent'
> = {
  admin: 'default',
  reviewer: 'accent',
  subscriber: 'secondary',
  system: 'outline',
}

const ACTION_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline'
> = {
  create: 'success',
  update: 'secondary',
  soft_delete: 'warning',
  restore: 'success',
  hard_delete: 'destructive',
  login: 'outline',
  logout: 'outline',
  role_change: 'warning',
  permission_change: 'warning',
  config_change: 'warning',
  crawl_complete: 'secondary',
}

// 13/05 14:23 — matches the wireframe sample.
const SHORT_DATETIME = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

// ISO + human-readable (used for tooltips so admins can copy the canonical
// timestamp).
const FULL_DATETIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
})

function formatShort(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return SHORT_DATETIME.format(d)
}

function formatFull(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${FULL_DATETIME.format(d)} (${iso})`
}

function shortUuid(value: string | null | undefined): string {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…` : value
}

export function AuditTable() {
  const router = useRouter()
  const sp = useSearchParams()
  const [, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Build the API params from the URL. The endpoint accepts more filters
  // (resourceType, resourceId, from, to) than the typed `adminApi.auditLogs.list`
  // signature currently advertises — we cast at the call site rather than
  // touching the shared `endpoints.ts` (which is outside this swarm's scope).
  const queryParams = useMemo(() => {
    const page = Math.max(1, Number(sp.get('page') ?? '1') || 1)
    const perPage = Math.min(
      200,
      Math.max(1, Number(sp.get('perPage') ?? '50') || 50),
    )
    const params: Record<string, string | number> = { page, perPage }
    for (const key of ['actorId', 'action', 'resourceType', 'resourceId', 'from', 'to'] as const) {
      const value = sp.get(key)
      if (value) params[key] = value
    }
    return params
  }, [sp])

  const { data, isPending, isError, error, isFetching, refetch } = useQuery<
    Paginated<AuditLogRow>
  >({
    queryKey: ['admin', 'audit-logs', queryParams],
    queryFn: () =>
      adminApi.auditLogs.list(
        queryParams as Parameters<typeof adminApi.auditLogs.list>[0],
      ) as Promise<Paginated<AuditLogRow>>,
    placeholderData: keepPreviousData,
  })

  const rows = data?.rows ?? []
  const total = data?.total ?? 0
  const page = Number(queryParams.page ?? 1)
  const perPage = data?.perPage ?? Number(queryParams.perPage ?? 50)
  const totalPages = Math.max(1, Math.ceil(total / perPage))

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), totalPages)
      const params = new URLSearchParams(sp.toString())
      if (clamped <= 1) params.delete('page')
      else params.set('page', String(clamped))
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `?${qs}` : '?', { scroll: false })
      })
    },
    [router, sp, totalPages],
  )

  return (
    <>
      <div
        className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
        aria-busy={isFetching ? 'true' : 'false'}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Waktu
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Aktor
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Role
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Action
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Resource
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Resource ID
                </th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <SkeletonRows />
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm">
                    <div className="text-[rgb(var(--danger))]">
                      Gagal memuat audit log
                      {error instanceof Error ? `: ${error.message}` : '.'}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => refetch()}
                    >
                      Coba lagi
                    </Button>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-sm text-[rgb(var(--text-muted))]"
                  >
                    Tidak ada entri audit yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const actionVariant = ACTION_VARIANT[row.action] ?? 'secondary'
                  const roleKey = row.actorRole ?? 'system'
                  const roleVariant = ROLE_VARIANT[roleKey] ?? 'outline'
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedId(row.id)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Buka diff audit log ${row.id}`}
                      className="cursor-pointer border-t border-[rgb(var(--border))] transition-colors hover:bg-[rgb(var(--bg-elevated))] focus-visible:bg-[rgb(var(--bg-elevated))] focus-visible:outline-none"
                    >
                      <td
                        className="px-3 py-2 align-top whitespace-nowrap font-mono text-xs text-[rgb(var(--text-muted))]"
                        title={formatFull(row.createdAt)}
                      >
                        {formatShort(row.createdAt)}
                      </td>
                      <td
                        className="px-3 py-2 align-top font-mono text-xs text-[rgb(var(--text))]"
                        title={row.actorId ?? 'system'}
                      >
                        {row.actorId ? shortUuid(row.actorId) : 'Sistem'}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Badge variant={roleVariant} className="capitalize">
                          {ROLE_LABEL[roleKey]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Badge variant={actionVariant} className="font-mono">
                          {row.action}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 align-top text-[rgb(var(--text))]">
                        {row.resourceType ?? '—'}
                      </td>
                      <td
                        className="px-3 py-2 align-top font-mono text-xs text-[rgb(var(--text-muted))]"
                        title={row.resourceId ?? ''}
                      >
                        {shortUuid(row.resourceId)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--text-muted))]">
        <span>
          {total > 0
            ? `Halaman ${page} / ${totalPages} · ${total} entri`
            : 'Tidak ada entri.'}
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || isFetching}
            onClick={() => goToPage(page - 1)}
          >
            Sebelumnya
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || isFetching}
            onClick={() => goToPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>

      <DiffModal
        id={selectedId}
        open={selectedId !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null)
        }}
      />
    </>
  )
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, idx) => (
        <tr key={idx} className="border-t border-[rgb(var(--border))]">
          {Array.from({ length: 6 }).map((__, col) => (
            <td key={col} className="px-3 py-2">
              <div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
