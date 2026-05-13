'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .max(128, 'Password maksimal 128 karakter'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Konfirmasi password tidak cocok',
  })

type ResetValues = z.infer<typeof resetSchema>

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <p style={{ color: 'rgb(var(--danger))' }}>
          Tautan reset tidak valid atau sudah kedaluwarsa.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm font-medium hover:underline"
          style={{ color: 'rgb(var(--accent))' }}
        >
          Minta tautan baru →
        </Link>
      </div>
    )
  }

  async function onSubmit(values: ResetValues) {
    setSubmitting(true)
    try {
      const fn = (authClient as unknown as {
        resetPassword?: (args: { newPassword: string; token: string }) => Promise<unknown>
      }).resetPassword
      if (typeof fn !== 'function') {
        throw new Error('Endpoint reset password belum tersedia.')
      }
      const result = await fn({ newPassword: values.password, token })
      const err = (result as { error?: { message?: string } | null }).error
      if (err) {
        toast.error(err.message || 'Gagal mengatur ulang password.')
        return
      }
      toast.success('Password berhasil diubah. Silakan masuk dengan password baru.')
      router.push('/login')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
      <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
        Buat password baru untuk akun Anda. Minimal 8 karakter.
      </p>

      <div className="space-y-2">
        <Label htmlFor="password">Password baru</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            aria-invalid={errors.password ? 'true' : 'false'}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3"
            style={{ color: 'rgb(var(--text-muted))' }}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
        <Input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Ulangi password baru"
          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memproses...
          </>
        ) : (
          'Atur ulang password'
        )}
      </Button>
    </form>
  )
}
