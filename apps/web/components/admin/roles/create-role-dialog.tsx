// `<CreateRoleDialog />` — modal form for POST /api/v1/admin/roles.
//
// Backend payload (see `apps/web/app/api/v1/admin/roles/route.ts`):
//   { slug: string, nameId: string, nameAr?: string, description?: string }
//
// `slug` must be lowercase snake_case (matches the server zod schema). The
// dialog mirrors that rule client-side so users get instant validation
// feedback. On success we toast, close, and bubble the new role row up via
// `onCreated` so the parent list can refresh.
//
// Brand: Atsar. Indonesian copy.

'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { adminApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2, 'Minimal 2 karakter')
    .max(64, 'Maksimal 64 karakter')
    .regex(/^[a-z][a-z0-9_]*$/, 'Gunakan huruf kecil, angka, underscore (snake_case)'),
  nameId: z.string().trim().min(1, 'Nama wajib diisi').max(120, 'Maksimal 120 karakter'),
  nameAr: z
    .string()
    .trim()
    .max(120, 'Maksimal 120 karakter')
    .optional()
    .or(z.literal('')),
  description: z
    .string()
    .trim()
    .max(500, 'Maksimal 500 karakter')
    .optional()
    .or(z.literal('')),
})

type CreateRoleValues = z.infer<typeof createSchema>

/** Shape of a freshly created role row, as returned by the API. */
export interface CreatedRole {
  id: string
  slug: string
  nameId: string
  nameAr: string | null
  description: string | null
  isSystem: boolean
}

export interface CreateRoleDialogProps {
  /** Called after a successful create. The parent should refresh its list. */
  onCreated?: (role: CreatedRole) => void
  /** Custom trigger button — defaults to the "+ Buat Role Custom" CTA. */
  trigger?: React.ReactNode
}

export function CreateRoleDialog({ onCreated, trigger }: CreateRoleDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CreateRoleValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { slug: '', nameId: '', nameAr: '', description: '' },
  })

  async function onSubmit(values: CreateRoleValues) {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        slug: values.slug,
        nameId: values.nameId,
      }
      if (values.nameAr && values.nameAr.length > 0) payload.nameAr = values.nameAr
      if (values.description && values.description.length > 0) {
        payload.description = values.description
      }

      const created = (await adminApi.roles.create(payload)) as CreatedRole

      toast.success(`Role "${created.nameId}" berhasil dibuat`)
      reset()
      setOpen(false)
      onCreated?.(created)
    } catch (err) {
      if (err instanceof ApiClientError) {
        // Surface server-side field errors on the matching inputs when present.
        if (err.fieldErrors) {
          for (const [field, message] of Object.entries(err.fieldErrors)) {
            if (field === 'slug' || field === 'nameId' || field === 'nameAr' || field === 'description') {
              setError(field, { type: 'server', message })
            }
          }
        }
        toast.error(err.message)
      } else {
        toast.error('Gagal membuat role')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            Buat Role Custom
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buat Role Baru</DialogTitle>
          <DialogDescription>
            Role custom dapat dikonfigurasi izinnya melalui Matrix Izin setelah
            dibuat.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 py-2" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="role-slug">
              Slug <span className="text-[rgb(var(--text-muted))]">(URL-safe)</span>
            </Label>
            <Input
              id="role-slug"
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="contoh: content_editor"
              aria-invalid={errors.slug ? 'true' : 'false'}
              {...register('slug')}
            />
            {errors.slug ? (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.slug.message}
              </p>
            ) : (
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Huruf kecil, angka, dan underscore. Tidak bisa diubah dengan
                mudah setelah dibuat.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-name-id">Nama (Indonesia)</Label>
            <Input
              id="role-name-id"
              type="text"
              autoComplete="off"
              placeholder="contoh: Editor Konten"
              aria-invalid={errors.nameId ? 'true' : 'false'}
              {...register('nameId')}
            />
            {errors.nameId && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.nameId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-name-ar">
              Nama (Arab) <span className="text-[rgb(var(--text-muted))]">— opsional</span>
            </Label>
            <Input
              id="role-name-ar"
              type="text"
              autoComplete="off"
              dir="rtl"
              placeholder="مثال: محرّر المحتوى"
              aria-invalid={errors.nameAr ? 'true' : 'false'}
              {...register('nameAr')}
            />
            {errors.nameAr && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.nameAr.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-description">
              Deskripsi <span className="text-[rgb(var(--text-muted))]">— opsional</span>
            </Label>
            <Textarea
              id="role-description"
              rows={3}
              placeholder="Jelaskan secara singkat tujuan role ini."
              aria-invalid={errors.description ? 'true' : 'false'}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.description.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Buat Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
