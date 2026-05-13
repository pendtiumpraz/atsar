'use client'

// Security — change password / 2FA toggle / active sessions.
//
// - Change password: POSTs to /api/auth/change-password. better-auth handles
//   the verification + hashing.
// - 2FA: placeholder switch — the actual flow lands later (TOTP enrollment).
// - Active sessions: GET /api/auth/sessions if exposed; falls back to a
//   single "current session" entry on 404 so the panel never looks broken.

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const pwdSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
    newPassword: z
      .string()
      .min(8, 'Password baru minimal 8 karakter')
      .max(128, 'Password baru maksimal 128 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak cocok',
  })

type PwdValues = z.infer<typeof pwdSchema>

interface SessionRow {
  id: string
  userAgent?: string
  ipAddress?: string
  current?: boolean
  createdAt?: string
}

function ChangePasswordSection() {
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PwdValues>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  async function onSubmit(values: PwdValues) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message ?? 'Gagal mengubah password')
      }
      toast.success('Password berhasil diubah')
      reset()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal mengubah password'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ubah Password</CardTitle>
        <CardDescription>
          Pilih password yang kuat dan unik untuk akun Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Password saat ini</Label>
            <Input
              id="currentPassword"
              type={showPwd ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={errors.currentPassword ? 'true' : 'false'}
              {...register('currentPassword')}
            />
            {errors.currentPassword && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Password baru</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showPwd ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                aria-invalid={errors.newPassword ? 'true' : 'false'}
                {...register('newPassword')}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3"
                style={{ color: 'rgb(var(--text-muted))' }}
                aria-label={showPwd ? 'Sembunyikan password' : 'Tampilkan password'}
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
            <Input
              id="confirmPassword"
              type={showPwd ? 'text' : 'password'}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? 'true' : 'false'}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Ubah password'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function TwoFactorSection() {
  const [enabled, setEnabled] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autentikasi Dua Faktor (2FA)</CardTitle>
        <CardDescription>
          Tingkatkan keamanan akun dengan kode TOTP dari aplikasi authenticator.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium">Aktifkan 2FA</p>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Fitur ini akan segera tersedia. Anda akan diminta memindai QR code.
          </p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(v) => {
            setEnabled(v)
            toast.info('2FA akan segera tersedia')
          }}
          aria-label="Toggle 2FA"
        />
      </CardContent>
    </Card>
  )
}

function ActiveSessionsSection() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetch('/api/auth/sessions', { credentials: 'include' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = (await res.json()) as unknown
        const list = Array.isArray(body)
          ? body
          : Array.isArray((body as { sessions?: unknown }).sessions)
            ? ((body as { sessions: unknown[] }).sessions)
            : []
        if (alive) setSessions(list as SessionRow[])
      } catch {
        // Endpoint not yet wired — render fallback.
        if (alive) setSessions(null)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sesi Aktif</CardTitle>
        <CardDescription>
          Perangkat dan browser yang sedang login pada akun Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--text-muted))]">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat sesi...
          </div>
        ) : sessions && sessions.length > 0 ? (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.userAgent ?? 'Browser tidak dikenali'}</p>
                  <p className="text-xs text-[rgb(var(--text-muted))]">
                    {s.ipAddress ?? 'IP tidak diketahui'}
                    {s.current ? ' · Saat ini' : ''}
                  </p>
                </div>
                {!s.current && (
                  <Button size="sm" variant="outline" disabled>
                    Logout
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-3 text-sm text-[rgb(var(--text-muted))]">
            <ShieldAlert className="mt-0.5 h-4 w-4" />
            <p>
              Daftar sesi belum tersedia. Untuk keamanan, Anda dapat logout dari menu
              pengguna kapan saja.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SecurityTab() {
  return (
    <div className="space-y-4">
      <ChangePasswordSection />
      <TwoFactorSection />
      <ActiveSessionsSection />
    </div>
  )
}
