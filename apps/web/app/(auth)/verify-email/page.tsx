'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, MailCheck, XCircle } from 'lucide-react'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type Status = 'pending' | 'verifying' | 'success' | 'error' | 'awaiting'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const email = searchParams.get('email') ?? ''

  const [status, setStatus] = useState<Status>(() =>
    token ? 'pending' : 'awaiting',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!token) return

    let cancelled = false
    async function verify() {
      setStatus('verifying')
      try {
        const fn = (authClient as unknown as {
          verifyEmail?: (args: { query: { token: string } }) => Promise<unknown>
        }).verifyEmail
        if (typeof fn !== 'function') {
          throw new Error('Endpoint verifikasi email belum tersedia.')
        }
        const result = await fn({ query: { token: token as string } })
        if (cancelled) return
        const err = (result as { error?: { message?: string } | null }).error
        if (err) {
          setErrorMessage(err.message || 'Token verifikasi tidak valid.')
          setStatus('error')
          return
        }
        setStatus('success')
        toast.success('Email berhasil diverifikasi.')
        // Redirect to onboarding after a brief pause so the user sees the success state
        setTimeout(() => {
          if (!cancelled) router.push('/welcome')
        }, 1200)
      } catch (e) {
        if (cancelled) return
        const msg = e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga.'
        setErrorMessage(msg)
        setStatus('error')
      }
    }
    void verify()
    return () => {
      cancelled = true
    }
  }, [token, router])

  async function handleResend() {
    if (!email) {
      toast.error('Email tidak diketahui. Silakan daftar ulang.')
      return
    }
    setResending(true)
    try {
      const fn = (authClient as unknown as {
        sendVerificationEmail?: (args: { email: string; callbackURL?: string }) => Promise<unknown>
      }).sendVerificationEmail
      if (typeof fn !== 'function') {
        throw new Error('Fitur kirim ulang email belum tersedia.')
      }
      const result = await fn({ email, callbackURL: '/welcome' })
      const err = (result as { error?: { message?: string } | null }).error
      if (err) {
        toast.error(err.message || 'Gagal mengirim ulang email verifikasi.')
        return
      }
      toast.success('Email verifikasi telah dikirim ulang.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga.'
      toast.error(msg)
    } finally {
      setResending(false)
    }
  }

  // ─── States ────────────────────────────────────────────────────────
  if (status === 'verifying' || status === 'pending') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}>
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'rgb(var(--primary))' }} />
          </div>
          <CardTitle className="text-2xl">Memverifikasi Email...</CardTitle>
          <CardDescription>Mohon tunggu sebentar.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (status === 'success') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}>
            <CheckCircle2 className="h-6 w-6" style={{ color: 'rgb(var(--success))' }} />
          </div>
          <CardTitle className="text-2xl">Email Terverifikasi</CardTitle>
          <CardDescription>
            Mengalihkan Anda ke onboarding...
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (status === 'error') {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}>
            <XCircle className="h-6 w-6" style={{ color: 'rgb(var(--danger))' }} />
          </div>
          <CardTitle className="text-2xl">Verifikasi Gagal</CardTitle>
          <CardDescription>
            {errorMessage ?? 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleResend} disabled={resending || !email} className="w-full">
            {resending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Mengirim ulang...
              </>
            ) : (
              'Kirim ulang email verifikasi'
            )}
          </Button>
          <Link
            href="/login"
            className="block text-center text-sm font-medium hover:underline"
            style={{ color: 'rgb(var(--accent))' }}
          >
            ← Kembali ke login
          </Link>
        </CardContent>
      </Card>
    )
  }

  // status === 'awaiting' — user just registered, no token in URL yet
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: 'rgb(var(--bg-elevated))' }}>
          <MailCheck className="h-6 w-6" style={{ color: 'rgb(var(--primary))' }} />
        </div>
        <CardTitle className="text-2xl">Cek Email Anda</CardTitle>
        <CardDescription>
          {email
            ? <>Kami mengirim tautan verifikasi ke <span style={{ color: 'rgb(var(--text))' }}>{email}</span>.</>
            : 'Kami mengirim tautan verifikasi ke email Anda.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
          Klik tautan di email tersebut untuk mengaktifkan akun Anda.
        </p>
        <Button
          onClick={handleResend}
          disabled={resending || !email}
          variant="outline"
          className="w-full"
        >
          {resending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Mengirim ulang...
            </>
          ) : (
            'Kirim ulang email verifikasi'
          )}
        </Button>
        <Link
          href="/login"
          className="block text-center text-sm font-medium hover:underline"
          style={{ color: 'rgb(var(--accent))' }}
        >
          ← Kembali ke login
        </Link>
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="h-10" />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
