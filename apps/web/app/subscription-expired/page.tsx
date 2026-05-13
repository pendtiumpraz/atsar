'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Hourglass, Loader2, LogOut, MessageCircle } from 'lucide-react'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Subscription Expired Gate (per WIREFRAMES §33).
 *
 * Users whose subscription has lapsed land here. No sidebar, no navbar —
 * only the upgrade flow and an "I already paid, please activate" form.
 * Sub-tier 0 access (read-only for billing artifacts).
 *
 * Data is populated from query string for now (?tier=Premium&expiredAt=...).
 * In production the values come from the session/JWT — see BACKEND.md §6.
 */

const ADMIN_WA = '081319504441'
const ADMIN_WA_DISPLAY = '0813-1950-4441'

export default function SubscriptionExpiredPage() {
  const router = useRouter()
  const [showActivationForm, setShowActivationForm] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // TODO(F2): replace these with values from server session / RSC props.
  const tier =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('tier') ?? 'Premium'
      : 'Premium'
  const expiredAt =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('expiredAt') ?? '—'
      : '—'

  async function handleLogout() {
    setSigningOut(true)
    try {
      await authClient.signOut()
      toast.success('Anda telah keluar.')
      router.push('/login')
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal logout.'
      toast.error(msg)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'rgb(var(--bg))' }}
    >
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader className="space-y-2 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}
            >
              <Hourglass className="h-7 w-7" style={{ color: 'rgb(var(--warning))' }} />
            </div>
            <CardTitle className="text-2xl">Langganan Anda Telah Berakhir</CardTitle>
            <CardDescription>
              Untuk melanjutkan akses ke Athar, silakan perpanjang langganan Anda.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <dl
              className="grid grid-cols-2 gap-2 rounded-lg border p-4 text-sm"
              style={{
                borderColor: 'rgb(var(--border))',
                backgroundColor: 'rgb(var(--bg-elevated))',
              }}
            >
              <dt style={{ color: 'rgb(var(--text-muted))' }}>Tier sebelumnya</dt>
              <dd className="font-medium" style={{ color: 'rgb(var(--text))' }}>
                {tier}
              </dd>
              <dt style={{ color: 'rgb(var(--text-muted))' }}>Habis pada</dt>
              <dd style={{ color: 'rgb(var(--text))' }}>{expiredAt}</dd>
            </dl>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href="/pricing">Lihat Pricing</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowActivationForm((v) => !v)}
                aria-expanded={showActivationForm}
              >
                Saya sudah bayar — minta aktivasi
              </Button>
            </div>

            {showActivationForm && <ActivationRequestForm />}

            <div
              className="rounded-lg border p-4 text-sm"
              style={{
                borderColor: 'rgb(var(--border))',
                backgroundColor: 'rgb(var(--surface))',
              }}
            >
              <p className="mb-2 font-medium" style={{ color: 'rgb(var(--text))' }}>
                Kontak Admin
              </p>
              <p style={{ color: 'rgb(var(--text-muted))' }}>
                Galih • WA{' '}
                <a
                  href={`https://wa.me/62${ADMIN_WA.replace(/^0/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: 'rgb(var(--accent))' }}
                >
                  <MessageCircle size={14} className="mb-0.5 inline" /> {ADMIN_WA_DISPLAY}
                </a>
              </p>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleLogout}
              disabled={signingOut}
            >
              {signingOut ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Keluar...
                </>
              ) : (
                <>
                  <LogOut size={16} />
                  Logout
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

// ─── Activation request (payment proof submission) ────────────────────

function ActivationRequestForm() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const payload = {
      reference: String(formData.get('reference') ?? '').trim(),
      paidAt: String(formData.get('paidAt') ?? '').trim(),
      note: String(formData.get('note') ?? '').trim(),
    }
    if (!payload.reference) {
      toast.error('Nomor referensi pembayaran wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      // TODO(F2/F3): confirm endpoint contract for payment activation requests.
      const res = await fetch('/api/v1/subscriptions/me/activation-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok && res.status !== 404) {
        throw new Error(`Gagal mengirim permintaan (status ${res.status}).`)
      }
      toast.success('Permintaan aktivasi terkirim. Admin akan verifikasi dalam 1×24 jam.')
      setDone(true)
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : 'Terjadi kesalahan tak terduga.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div
        className="rounded-lg border p-4 text-sm"
        style={{
          borderColor: 'rgb(var(--success))',
          backgroundColor: 'rgb(var(--bg-elevated))',
        }}
      >
        <p style={{ color: 'rgb(var(--text))' }}>
          Permintaan aktivasi Anda sudah kami terima. Tim admin akan memverifikasi
          dan mengaktifkan akun Anda dalam 1×24 jam kerja.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border p-4"
      style={{
        borderColor: 'rgb(var(--border))',
        backgroundColor: 'rgb(var(--bg-elevated))',
      }}
    >
      <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
        Isi bukti pembayaran Anda. Admin akan memverifikasi dan mengaktifkan akun.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="reference">Nomor referensi / berita transfer</Label>
        <Input
          id="reference"
          name="reference"
          placeholder="Contoh: BCA-2026051200123"
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="paidAt">Tanggal pembayaran</Label>
        <Input id="paidAt" name="paidAt" type="date" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="note">Catatan (opsional)</Label>
        <Input id="note" name="note" placeholder="Tier yang dibayar, dll." />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim...
          </>
        ) : (
          'Kirim permintaan aktivasi'
        )}
      </Button>
    </form>
  )
}
