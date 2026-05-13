'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const forgotSchema = z.object({
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
})

type ForgotValues = z.infer<typeof forgotSchema>

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotValues) {
    setSubmitting(true)
    try {
      // better-auth method: `forgetPassword` (UK spelling per upstream SDK)
      const fn = (authClient as unknown as {
        forgetPassword?: (args: { email: string; redirectTo?: string }) => Promise<unknown>
      }).forgetPassword
      if (typeof fn !== 'function') {
        throw new Error('Endpoint reset password belum tersedia.')
      }
      const result = await fn({
        email: values.email,
        redirectTo: '/reset-password',
      })
      const err = (result as { error?: { message?: string } | null }).error
      if (err) {
        toast.error(err.message || 'Gagal mengirim email reset.')
        return
      }
      toast.success('Email reset password telah dikirim. Cek inbox Anda.')
      setSent(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p style={{ color: 'rgb(var(--text))' }}>
          Kami telah mengirim tautan reset password ke email Anda. Periksa
          inbox (dan folder spam jika perlu).
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium hover:underline"
          style={{ color: 'rgb(var(--accent))' }}
        >
          ← Kembali ke login
        </Link>
      </div>
    )
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
        Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur
        ulang password.
      </p>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="anda@email.com"
          aria-invalid={errors.email ? 'true' : 'false'}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim...
          </>
        ) : (
          'Kirim tautan reset'
        )}
      </Button>

      <p className="text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
        Ingat password Anda?{' '}
        <Link
          href="/login"
          className="font-medium hover:underline"
          style={{ color: 'rgb(var(--accent))' }}
        >
          Masuk →
        </Link>
      </p>
    </form>
  )
}
