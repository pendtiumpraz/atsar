// `/admin/users/[id]` — single user detail (WIREFRAMES §19 follow-on).
//
// Server component. Fetches the user via the user service directly (same
// process — skipping a self-HTTP hop) and renders a profile card plus a
// recent-activity placeholder. The activity panel is intentionally light:
// Phase 7 will wire it to `admin/audit-logs?actorId=<id>`. For now we surface
// the basic identity, role badges, registration / last-login timestamps and
// a link to the audit log.

import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { ArrowLeft } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import * as userService from '@/lib/server/services/user.service'

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
            <Link href="/users">
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
        {/* ── Profile card ─────────────────────────────────────────── */}
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
                  {user.roleSlugs.length > 0 ? (
                    user.roleSlugs.map((slug) => (
                      <Badge key={slug} variant="secondary">
                        {slug}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-[rgb(var(--text-muted))]">
                      Belum punya role
                    </span>
                  )}
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

        {/* ── Activity / meta side panel ───────────────────────────── */}
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

          <Card>
            <CardHeader>
              <CardTitle>Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Subscription detail joins are coming in Phase 7. For now we
                  link to the subscriptions admin panel filtered by user. */}
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/subscriptions?userId=${user.id}`}>
                  Lihat di Subscriptions →
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/audit-logs?actorId=${user.id}`}>
                  Lihat Audit Log →
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
