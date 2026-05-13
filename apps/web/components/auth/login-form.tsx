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

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  password: z
    .string()
    .min(1, 'Password wajib diisi')
    .min(8, 'Password minimal 8 karakter'),
  rememberMe: z.boolean().optional(),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('from') || '/dashboard'

  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  })

  async function onSubmit(values: LoginValues) {
    setSubmitting(true)
    try {
      const result = await authClient.signIn.email({
        email: values.email,
        password: values.password,
        rememberMe: values.rememberMe ?? false,
        callbackURL: redirectTo,
      })

      // better-auth returns `{ data, error }` (no throw on bad credentials)
      const err = (result as { error?: { message?: string } | null }).error
      if (err) {
        toast.error(err.message || 'Login gagal. Coba lagi.')
        return
      }

      toast.success('Berhasil masuk. Mengalihkan...')
      router.push(redirectTo)
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Terjadi kesalahan tak terduga.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
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

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
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

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 select-none" style={{ color: 'rgb(var(--text-muted))' }}>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border"
            style={{ accentColor: 'rgb(var(--primary))' }}
            {...register('rememberMe')}
          />
          Ingat saya
        </label>
        <Link
          href="/forgot-password"
          className="hover:underline"
          style={{ color: 'rgb(var(--accent))' }}
        >
          Lupa password?
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memproses...
          </>
        ) : (
          'Masuk'
        )}
      </Button>

      <p className="text-center text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
        Belum punya akun?{' '}
        <Link
          href="/register"
          className="font-medium hover:underline"
          style={{ color: 'rgb(var(--accent))' }}
        >
          Daftar →
        </Link>
      </p>
    </form>
  )
}
