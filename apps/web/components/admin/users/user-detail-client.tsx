// `<UserDetailClient />` — interactive shell for `/admin/users/[id]`.
//
// The server component (`page.tsx`) hands us the canonical user row +
// pre-loaded tier catalog so this file owns the dialog state, payment
// history, subscription summary and audit log fetches.  Everything goes
// through TanStack Query so we get instant cache hits when navigating
// between siblings.
//
// Sections rendered here (top → bottom):
//   1. Identity card with avatar, name, status badges and role badges
//      (button → <EditRolesDialog />).
//   2. Subscription summary card (current tier, expires_at, billing cycle)
//      + "Aktivasi manual" button → <ActivateDialog />. We fetch the user's
//      most recent subscription via `/admin/subscriptions?userId=:id`.
//   3. Payment history table — `/admin/payments?userId=:id`.
//   4. Audit log — `/admin/audit-logs?actorId=:id` (most recent 20 by/on
//      this user).
//   5. Danger zone — soft delete + force log out (force log out is
//      surfaced as TODO since better-auth does not expose a session-revoke
//      admin API yet).
//
// All copy is Indonesian per the admin UX convention.

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  CreditCard,
  KeyRound,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserCog,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi, paymentsApi, subscriptionsApi, type Paginated } from '@/lib/api/endpoints'
import { confirm, deleteConfirm } from '@/lib/swal'
import { EditRolesDialog } from '@/components/admin/users/edit-roles-dialog'
import {
  ActivateDialog,
  type ActivateTierOption,
  type BillingCycle,
} from '@/components/admin/subscriptions/activate-dialog'

// ── Shared types ──────────────────────────────────────────────────────
interface UserShape {
  id: string
  email: string
  fullName: string
  displayName: string | null
  emailVerifiedAt: string | Date | null
  deletedAt: string | Date | null
  roleIds: string[]
  roleSlugs: string[]
}

interface SubscriptionShape {
  id: string
  userId: string
  tierId: string
  status: 'trial' | 'active' | 'expired' | 'cancelled'
  billingCycle: BillingCycle | null
  startedAt: string | null
  expiresAt: string | null
  trialUntil: string | null
  tier?: { id: string; slug: string; nameId: string } | null
}

interface PaymentShape {
  id: string
  userId: string
  amountIdr: number
  method: string
  reference: string | null
  proofUrl: string | null
  status: 'pending' | 'confirmed' | 'rejected'
  confirmedAt: string | null
  createdAt: string
}

interface AuditShape {
  id: string
  actorId: string | null
  actorRole: string | null
  action: string
  resourceType: string | null
  resourceId: string | null
  createdAt: string
}

function formatIdr(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0'
  return `Rp ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d)
}

const STATUS_VARIANT: Record<
  SubscriptionShape['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  trial: 'secondary',
  active: 'default',
  expired: 'destructive',
  cancelled: 'outline',
}

const STATUS_LABEL: Record<SubscriptionShape['status'], string> = {
  trial: 'Trial',
  active: 'Aktif',
  expired: 'Kedaluwarsa',
  cancelled: 'Dibatalkan',
}

const PAYMENT_VARIANT: Record<
  PaymentShape['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'outline',
  confirmed: 'default',
  rejected: 'destructive',
}

const PAYMENT_LABEL: Record<PaymentShape['status'], string> = {
  pending: 'Menunggu',
  confirmed: 'Terkonfirmasi',
  rejected: 'Ditolak',
}

// ── Component ─────────────────────────────────────────────────────────
export interface UserDetailClientProps {
  user: UserShape
  tiers: ActivateTierOption[]
}

export function UserDetailClient({ user, tiers }: UserDetailClientProps) {
  const router = useRouter()
  const [rolesOpen, setRolesOpen] = React.useState(false)
  const [activateOpen, setActivateOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  // ── Subscription (most recent for this user, any state) ────────────
  const subscriptionQuery = useQuery<Paginated<SubscriptionShape>>({
    queryKey: ['admin', 'user', user.id, 'subscriptions'],
    queryFn: () =>
      subscriptionsApi.admin.list({
        userId: user.id,
        perPage: 5,
      }) as Promise<Paginated<SubscriptionShape>>,
  })

  const currentSubscription: SubscriptionShape | null = React.useMemo(() => {
    const rows = subscriptionQuery.data?.rows ?? []
    // The list is ordered by `createdAt desc`, so rows[0] is "most recent".
    return rows[0] ?? null
  }, [subscriptionQuery.data])

  // ── Payments by this user ───────────────────────────────────────────
  const paymentsQuery = useQuery<Paginated<PaymentShape>>({
    queryKey: ['admin', 'user', user.id, 'payments'],
    queryFn: () =>
      paymentsApi.admin.list({
        userId: user.id,
        perPage: 10,
      }) as Promise<Paginated<PaymentShape>>,
  })

  // ── Audit log (actor OR target) ─────────────────────────────────────
  const auditByQuery = useQuery<Paginated<AuditShape>>({
    queryKey: ['admin', 'user', user.id, 'audit-by'],
    queryFn: () =>
      adminApi.auditLogs.list({
        actorId: user.id,
        perPage: 10,
      }) as Promise<Paginated<AuditShape>>,
  })

  const auditOnQuery = useQuery<Paginated<AuditShape>>({
    queryKey: ['admin', 'user', user.id, 'audit-on'],
    queryFn: () =>
      adminApi.auditLogs.list({
        resourceId: user.id,
        perPage: 10,
      }) as Promise<Paginated<AuditShape>>,
  })

  // Merge + sort + dedupe by id so a self-action only appears once.
  const auditRows: AuditShape[] = React.useMemo(() => {
    const seen = new Set<string>()
    const out: AuditShape[] = []
    for (const row of [
      ...(auditByQuery.data?.rows ?? []),
      ...(auditOnQuery.data?.rows ?? []),
    ]) {
      if (seen.has(row.id)) continue
      seen.add(row.id)
      out.push(row)
    }
    out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return out.slice(0, 20)
  }, [auditByQuery.data, auditOnQuery.data])

  // ── Danger zone actions ─────────────────────────────────────────────
  async function handleSoftDelete() {
    const ok = await deleteConfirm(user.email)
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      toast.success('User dipindahkan ke Sampah')
      router.push('/admin/users')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus user'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword() {
    const ok = await confirm({
      title: 'Kirim email reset password?',
      text: `Link reset akan dikirim ke ${user.email}.`,
      confirmText: 'Kirim',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, redirectTo: '/reset-password' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Email reset password terkirim')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email reset'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const isDeleted = !!user.deletedAt
  const canActivate = !!currentSubscription && !isDeleted

  return (
    <div className="flex flex-col gap-6">
      {/* ── Roles ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Role
            </CardTitle>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Akses platform ditentukan oleh role yang dipasang. Lihat
              <code className="mx-1 rounded bg-[rgb(var(--bg-elevated))] px-1 py-0.5 font-mono text-[10px]">
                seeders/001_roles.ts
              </code>
              untuk katalog.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRolesOpen(true)}
            disabled={isDeleted}
          >
            <ShieldCheck className="h-4 w-4" />
            Edit Role
          </Button>
        </CardHeader>
        <CardContent>
          {user.roleSlugs.length === 0 ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">
              Belum punya role. User tidak akan bisa akses panel apa pun
              sampai role ditambahkan.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {user.roleSlugs.map((slug) => (
                <Badge key={slug} variant="secondary" className="capitalize">
                  {slug}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Subscription ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Langganan
            </CardTitle>
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Status, tier, dan masa berlaku akses.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setActivateOpen(true)}
            disabled={!canActivate || subscriptionQuery.isPending}
            title={
              currentSubscription
                ? 'Aktivasi manual setelah verifikasi pembayaran'
                : 'Belum ada baris subscription untuk user ini'
            }
          >
            Aktivasi manual
          </Button>
        </CardHeader>
        <CardContent>
          {subscriptionQuery.isPending ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">Memuat…</p>
          ) : !currentSubscription ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">
              User belum punya baris subscription. Trial otomatis dibuat saat
              login pertama; jika belum, minta user login dahulu.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tier">
                {currentSubscription.tier?.nameId ?? '—'}{' '}
                <span className="text-xs text-[rgb(var(--text-muted))]">
                  ({currentSubscription.tier?.slug ?? currentSubscription.tierId.slice(0, 8)})
                </span>
              </Field>
              <Field label="Status">
                <Badge variant={STATUS_VARIANT[currentSubscription.status]}>
                  {STATUS_LABEL[currentSubscription.status]}
                </Badge>
              </Field>
              <Field label="Periode">
                {currentSubscription.billingCycle
                  ? currentSubscription.billingCycle === 'yearly'
                    ? 'Tahunan'
                    : 'Bulanan'
                  : '—'}
              </Field>
              <Field label="Mulai">{formatDate(currentSubscription.startedAt)}</Field>
              <Field label="Berakhir">{formatDate(currentSubscription.expiresAt)}</Field>
              <Field label="Trial s/d">{formatDate(currentSubscription.trialUntil)}</Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payments ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Riwayat Pembayaran
          </CardTitle>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            10 transaksi terbaru.{' '}
            <Link
              href={`/admin/payments?userId=${user.id}`}
              className="underline-offset-2 hover:underline"
            >
              Lihat semua →
            </Link>
          </p>
        </CardHeader>
        <CardContent>
          {paymentsQuery.isPending ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">Memuat…</p>
          ) : (paymentsQuery.data?.rows ?? []).length === 0 ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">
              Belum ada pembayaran tercatat.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[rgb(var(--border))]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Tanggal</th>
                    <th className="px-3 py-2 font-medium">Nominal</th>
                    <th className="px-3 py-2 font-medium">Metode</th>
                    <th className="px-3 py-2 font-medium">Referensi</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Bukti</th>
                  </tr>
                </thead>
                <tbody>
                  {(paymentsQuery.data?.rows ?? []).map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-[rgb(var(--border))]"
                    >
                      <td className="px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
                        {formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-medium">{formatIdr(p.amountIdr)}</td>
                      <td className="px-3 py-2 text-xs">{p.method}</td>
                      <td
                        className="px-3 py-2 font-mono text-xs text-[rgb(var(--text-muted))]"
                        title={p.reference ?? ''}
                      >
                        {p.reference ? p.reference.slice(0, 20) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={PAYMENT_VARIANT[p.status]}>
                          {PAYMENT_LABEL[p.status]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        {p.proofUrl ? (
                          <a
                            href={p.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline-offset-2 hover:underline"
                          >
                            Lihat
                          </a>
                        ) : (
                          <span className="text-xs text-[rgb(var(--text-muted))]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Audit log ────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Audit Log
          </CardTitle>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Aksi terbaru oleh / terhadap user ini.{' '}
            <Link
              href={`/admin/audit-logs?actorId=${user.id}`}
              className="underline-offset-2 hover:underline"
            >
              Lihat semua →
            </Link>
          </p>
        </CardHeader>
        <CardContent>
          {auditByQuery.isPending || auditOnQuery.isPending ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">Memuat…</p>
          ) : auditRows.length === 0 ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">
              Tidak ada entri audit untuk user ini.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {auditRows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {row.action}
                    </Badge>
                    <span className="truncate text-xs text-[rgb(var(--text-muted))]">
                      {row.resourceType ?? '—'}
                      {row.resourceId
                        ? ` · ${row.resourceId.slice(0, 8)}…`
                        : ''}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-[rgb(var(--text-muted))]">
                    {formatDateTime(row.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Danger zone ──────────────────────────────────────────── */}
      <Card className="border-[rgb(var(--danger))]/40">
        <CardHeader className="space-y-1">
          <CardTitle className="text-[rgb(var(--danger))]">Zona Bahaya</CardTitle>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Tindakan irreversible untuk user ini. Tidak ada refund (lihat
            BACKEND.md §2.5).
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || isDeleted}
            onClick={handleResetPassword}
          >
            <KeyRound className="h-4 w-4" />
            Kirim Reset Password
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Belum tersedia: better-auth tidak expose endpoint revoke session admin"
          >
            Paksa Logout (segera)
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || isDeleted}
            onClick={handleSoftDelete}
          >
            <Trash2 className="h-4 w-4" />
            Hapus (Soft)
          </Button>
        </CardContent>
      </Card>

      {/* Dialogs (siblings of cards so Radix focus traps don't conflict). */}
      <EditRolesDialog
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        userId={user.id}
        userEmail={user.email}
        currentRoleIds={user.roleIds}
        onSaved={() => {
          setRolesOpen(false)
          // Server component owns user.roleIds; force a refresh.
          router.refresh()
        }}
      />

      <ActivateDialog
        open={activateOpen}
        onOpenChange={setActivateOpen}
        subscriptionId={currentSubscription?.id ?? null}
        label={user.email}
        tiers={tiers}
        defaultTierId={currentSubscription?.tierId}
        defaultBillingCycle={
          currentSubscription?.billingCycle === 'yearly' ? 'yearly' : 'monthly'
        }
        onActivated={() => {
          void subscriptionQuery.refetch()
          void paymentsQuery.refetch()
          router.refresh()
        }}
      />

    </div>
  )
}

// Tiny presentation helper — co-located so the file stays self-contained.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {label}
      </span>
      <div className="text-sm text-[rgb(var(--text))]">{children}</div>
    </div>
  )
}

