'use client'

// Profile settings — name, display name, avatar, phone.
// PATCH /api/v1/users/me on submit. Avatar uploader is a placeholder
// (TODO: wire to `uploadsApi.upload` once the design ships an image cropper).

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, UserCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api, ApiClientError } from '@/lib/api/client'

const profileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Nama lengkap minimal 2 karakter')
    .max(120, 'Nama lengkap maksimal 120 karakter'),
  displayName: z.string().max(80, 'Maksimal 80 karakter').optional().or(z.literal('')),
  phone: z
    .string()
    .max(32, 'Nomor telepon terlalu panjang')
    .regex(/^[+0-9\s\-()]*$/u, 'Nomor telepon tidak valid')
    .optional()
    .or(z.literal('')),
})

type ProfileValues = z.infer<typeof profileSchema>

export interface ProfileTabInitial {
  email: string
  emailVerified: boolean
  fullName: string
  displayName: string
  avatarUrl: string
  phone: string
}

interface ProfileTabProps {
  initial: ProfileTabInitial
}

export function ProfileTab({ initial }: ProfileTabProps) {
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: initial.fullName,
      displayName: initial.displayName,
      phone: initial.phone,
    },
  })

  async function onSubmit(values: ProfileValues) {
    setSubmitting(true)
    try {
      await api.patch('/users/me', {
        fullName: values.fullName,
        displayName: values.displayName || null,
        phone: values.phone || null,
      })
      toast.success('Profil berhasil diperbarui')
      reset(values, { keepValues: true })
    } catch (e) {
      const msg =
        ApiClientError.is(e)
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Gagal menyimpan profil'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil</CardTitle>
        <CardDescription>
          Informasi yang ditampilkan pada akun Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]">
              {initial.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={initial.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <UserCircle2 className="h-10 w-10 text-[rgb(var(--text-faint))]" />
              )}
            </div>
            <div>
              <Button type="button" variant="outline" size="sm" disabled>
                Ganti foto
              </Button>
              <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                Unggah foto (segera hadir)
              </p>
            </div>
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="flex items-center gap-2">
              <Input id="email" type="email" value={initial.email} disabled />
              {initial.emailVerified ? (
                <span
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: 'rgb(var(--primary))' }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Terverifikasi
                </span>
              ) : (
                <span
                  className="text-xs"
                  style={{ color: 'rgb(var(--warning))' }}
                >
                  Belum diverifikasi
                </span>
              )}
            </div>
          </div>

          {/* Full name */}
          <div className="space-y-2">
            <Label htmlFor="fullName">Nama lengkap</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              aria-invalid={errors.fullName ? 'true' : 'false'}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.fullName.message}
              </p>
            )}
          </div>

          {/* Display name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Nama tampilan</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Opsional"
              aria-invalid={errors.displayName ? 'true' : 'false'}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.displayName.message}
              </p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Nomor telepon</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+62..."
              autoComplete="tel"
              aria-invalid={errors.phone ? 'true' : 'false'}
              {...register('phone')}
            />
            {errors.phone && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !isDirty}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
