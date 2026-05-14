// `/admin/users/[id]` — single user detail.
//
// Server component. Loads the canonical user row + the tier catalog (so the
// activate-subscription dialog renders without a second round-trip), then
// hands off to `<UserDetailClient />` for the interactive sections (roles
// dialog, subscription summary, payment history, audit log, danger zone).
//
// Sections rendered on this page:
//   1. Identity card (server) — avatar, full name, email, status, register +
//      last-login timestamps. No client state needed.
//   2. <UserDetailClient /> — every interactive section, see its module doc.

import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { db } from '@athar/db'
import { tiers } from '@athar/db/schema'
import * as userService from '@/lib/server/services/user.service'
import { UserDetailClient } from '@/components/admin/users/user-detail-client'
import type { ActivateTierOption } from '@/components/admin/subscriptions/activate-dialog'

export const dynamic = 'force-dynamic'

interface DetailProps {
  params: Promise<{ id: string }>
}

const idSchema = z.string().uuid()

export async function generateMetadata({ params }: DetailProps): Promise<Metadata> {
  const { id } = await params
  return { title: `User · ${id.slice(0, 8)} · Admin · Atsar` }
}

function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d)
}

function initials(name: string | null | undefined, email: string): string {
  const source = (name && name.trim().length > 0 ? name : email).trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

interface FieldProps {
  label: string
  children: React.ReactNode
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {label}
      </span>
      <div className="text-sm text-[rgb(var(--text))]">{children}</div>
    </div>
  )
}

async function loadTiers(): Promise<ActivateTierOption[]> {
  try {
    const rows = await db
      .select({
        id: tiers.id,
        slug: tiers.slug,
        nameId: tiers.nameId,
        priceMonthlyIdr: tiers.priceMonthlyIdr,
        priceYearlyIdr: tiers.priceYearlyIdr,
        displayOrder: tiers.displayOrder,
      })
      .from(tiers)
      .where(and(isNull(tiers.deletedAt), eq(tiers.isActive, true)))
      .orderBy(asc(tiers.displayOrder), asc(tiers.priceMonthlyIdr))
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      nameId: r.nameId,
      priceMonthlyIdr: r.priceMonthlyIdr,
      priceYearlyIdr: r.priceYearlyIdr,
    }))
  } catch {
    return []
  }
}

export default async function AdminUserDetailPage({ params }: DetailProps) {
  const { id: rawId } = await params
  const parsed = idSchema.safeParse(rawId)
  if (!parsed.success) notFound()

  let user
  try {
    user = await userService.getById(parsed.data)
  } catch {
    notFound()
  }

  const tierList = await loadTiers()

  const status = user.deletedAt
    ? { label: 'Terhapus', cls: 'border-[rgb(var(--danger))] text-[rgb(var(--danger))]' }
    : user.emailVerifiedAt
      ? { label: 'Aktif', cls: 'bg-[rgb(var(--success))] text-white' }
      : { label: 'Belum Verifikasi', cls: '' }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1
              className="text-2xl font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              Detail User
            </h1>
            <p className="text-sm text-[rgb(var(--text-muted))]">{user.email}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ── Identity / profile card (server-rendered) ──────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {user.avatarUrl ? (
                  <AvatarImage src={user.avatarUrl} alt={user.fullName} />
                ) : null}
                <AvatarFallback>{initials(user.fullName, user.email)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-lg font-semibold">{user.fullName}</div>
                {user.displayName && user.displayName !== user.fullName ? (
                  <div className="text-sm text-[rgb(var(--text-muted))]">
                    {user.displayName}
                  </div>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={status.cls}>
                    {status.label}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email">{user.email}</Field>
              <Field label="Telepon">{user.phone ?? '—'}</Field>
              <Field label="Locale">{user.locale}</Field>
              <Field label="Tema">{user.themePreference}</Field>
              <Field label="Kalender">{user.calendarPreference}</Field>
              <Field label="Verified at">{formatDateTime(user.emailVerifiedAt)}</Field>
            </div>
          </CardContent>
        </Card>

        {/* ── Activity meta side panel ──────────────────────────── */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Aktivitas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Terdaftar">{formatDateTime(user.registeredAt)}</Field>
              <Field label="Login Terakhir">{formatDateTime(user.lastLoginAt)}</Field>
              <Field label="Aktif Terakhir">{formatDateTime(user.lastActiveAt)}</Field>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Interactive sections (roles, subscription, payments,
            audit, danger zone) — wrapped in a client component. */}
      <UserDetailClient
        user={{
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          displayName: user.displayName,
          emailVerifiedAt:
            user.emailVerifiedAt instanceof Date
              ? user.emailVerifiedAt.toISOString()
              : user.emailVerifiedAt,
          deletedAt:
            user.deletedAt instanceof Date
              ? user.deletedAt.toISOString()
              : user.deletedAt,
          roleIds: user.roleIds,
          roleSlugs: user.roleSlugs,
        }}
        tiers={tierList}
      />
    </div>
  )
}
