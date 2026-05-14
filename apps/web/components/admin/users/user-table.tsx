// `<UserTable />` — paginated list with search + filters for `/admin/users`.
//
// State management:
//   - Filters (q, role, status, page) are kept as local React state. We don't
//     mirror them into the URL yet — Phase 7 can layer that on with
//     `useSearchParams` without changing the API surface here.
//   - Data fetching uses TanStack Query keyed on the filters tuple, with a
//     30 s stale time. The query refetches automatically whenever the user
//     types in the search box (debounced inside `<Filters />`).
//   - Mutations (suspend / reset / delete / role edit) live in the row's
//     `<UserActionsMenu />`. On success it calls `onMutated`, which we wire to
//     `query.refetch()` here so the row reflects the new state immediately.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Loader2, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { adminApi, type Paginated } from '@/lib/api/endpoints'
import { UserActionsMenu, type UserActionsRow } from './user-actions-menu'

interface UserRow extends UserActionsRow {
  fullName: string
  displayName: string | null
  registeredAt: string | Date | null
  lastLoginAt: string | Date | null
  // Subscription tier is denormalised onto the user response in some phases;
  // tolerate either shape rather than crashing.
  subscriptionTier?: string | null
  tier?: string | null
}

interface RoleOption {
  id: string
  slug: string
  nameId: string
}

const PER_PAGE = 10

const ALL_ROLE = '__all__'
const ALL_STATUS = '__all__'

type StatusFilter = 'active' | 'unverified' | 'deleted'

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)
}

function StatusBadge({ user }: { user: UserRow }) {
  if (user.deletedAt) {
    return (
      <Badge variant="outline" className="border-[rgb(var(--danger))] text-[rgb(var(--danger))]">
        Terhapus
      </Badge>
    )
  }
  if (!user.emailVerifiedAt) {
    return <Badge variant="outline">Belum Verifikasi</Badge>
  }
  return (
    <Badge className="bg-[rgb(var(--success))] text-white">Aktif</Badge>
  )
}

function TierBadge({ user }: { user: UserRow }) {
  const tier = user.subscriptionTier ?? user.tier ?? null
  if (!tier) return <span className="text-xs text-[rgb(var(--text-muted))]">—</span>
  return <Badge variant="secondary">{tier}</Badge>
}

/** Debounce helper for the search input. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export interface UserTableProps {
  /** Bump this number from the parent to force a refetch (e.g. after invite). */
  refreshKey?: number
}

export function UserTable({ refreshKey = 0 }: UserTableProps) {
  const [qInput, setQInput] = useState('')
  const q = useDebounced(qInput, 300)
  const [role, setRole] = useState<string>(ALL_ROLE)
  const [status, setStatus] = useState<string>(ALL_STATUS)
  const [page, setPage] = useState(1)

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1)
  }, [q, role, status])

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminApi.roles.list() as Promise<RoleOption[]>,
    staleTime: 60_000,
  })

  const params = useMemo(
    () => ({
      q: q || undefined,
      role: role === ALL_ROLE ? undefined : role,
      status: status === ALL_STATUS ? undefined : (status as StatusFilter),
      page,
      perPage: PER_PAGE,
    }),
    [q, role, status, page],
  )

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', params, refreshKey],
    // The typed `adminApi.users.list` helper doesn't expose `status` yet —
    // backend supports it (route.ts → listQuerySchema), so we cast around the
    // type to keep the call site terse. Tighten in endpoints.ts when Phase 7
    // hardens the response shape.
    queryFn: () =>
      adminApi.users.list(params as Parameters<typeof adminApi.users.list>[0]) as Promise<
        Paginated<UserRow>
      >,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })

  const rows = usersQuery.data?.rows ?? []
  const total = usersQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'rgb(var(--text-muted))' }}
          />
          <Input
            type="search"
            placeholder="Cari email atau nama…"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            className="pl-8"
            aria-label="Cari user"
          />
        </div>

        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-[160px]" aria-label="Filter role">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ROLE}>Semua Role</SelectItem>
            {(rolesQuery.data ?? []).map((r) => (
              <SelectItem key={r.id} value={r.slug}>
                {r.nameId}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]" aria-label="Filter status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>Semua Status</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="unverified">Belum Verifikasi</SelectItem>
            <SelectItem value="deleted">Terhapus</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Terdaftar</th>
                <th className="px-4 py-3 font-medium">Login Terakhir</th>
                <th className="px-4 py-3 text-right font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[rgb(var(--text-muted))]"
                  >
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : usersQuery.isError ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'rgb(var(--danger))' }}>
                    Gagal memuat daftar user.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-[rgb(var(--text-muted))]"
                  >
                    Tidak ada user yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                rows.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]"
                  >
                    <td className="px-4 py-3 font-medium">{user.email}</td>
                    <td className="px-4 py-3">{user.fullName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.roleSlugs.length === 0 ? (
                          <span className="text-xs text-[rgb(var(--text-muted))]">—</span>
                        ) : (
                          user.roleSlugs.map((slug) => (
                            <Badge key={slug} variant="secondary">
                              {slug}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge user={user} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge user={user} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgb(var(--text-muted))]">
                      {formatDate(user.registeredAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[rgb(var(--text-muted))]">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActionsMenu
                        user={user}
                        onMutated={() => {
                          void usersQuery.refetch()
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-[rgb(var(--text-muted))]">
          {total > 0 ? (
            <>
              Halaman {page} dari {totalPages} · {total} user
            </>
          ) : (
            '0 user'
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || usersQuery.isFetching}
          >
            Sebelumnya
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || usersQuery.isFetching}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  )
}
