// `<InviteUserDialog />` — modal form for POST /admin/users.
//
// Backend expects { email, fullName, roleSlug }.  We fetch the role catalog
// lazily (only when the dialog opens) and surface it as a Select.  On success
// we toast, close, and call `onInvited` so the parent can refetch.

'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, UserPlus } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, ApiClientError } from '@/lib/api/client'
import { adminApi } from '@/lib/api/endpoints'

const inviteSchema = z.object({
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid')
    .max(254),
  fullName: z
    .string()
    .min(1, 'Nama lengkap wajib diisi')
    .max(120, 'Nama terlalu panjang'),
  roleSlug: z.string().min(1, 'Role wajib dipilih').max(64),
})

type InviteValues = z.infer<typeof inviteSchema>

interface RoleOption {
  id: string
  slug: string
  nameId: string
}

export interface InviteUserDialogProps {
  /** Called after a successful invite so the parent list can refresh. */
  onInvited?: () => void
}

export function InviteUserDialog({ onInvited }: InviteUserDialogProps = {}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminApi.roles.list() as Promise<RoleOption[]>,
    enabled: open,
    staleTime: 60_000,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', fullName: '', roleSlug: '' },
  })

  const roleSlug = watch('roleSlug')

  async function onSubmit(values: InviteValues) {
    setSubmitting(true)
    try {
      await api.post('/admin/users', values)
      toast.success(`Undangan terkirim ke ${values.email}`)
      reset()
      setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      onInvited?.()
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal mengundang user'
      toast.error(msg)
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
        <Button>
          <UserPlus className="h-4 w-4" />
          Undang User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Undang User Baru</DialogTitle>
          <DialogDescription>
            User akan menerima email dengan magic link untuk mengaktifkan akun.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4 py-2" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              placeholder="user@email.com"
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
            <Label htmlFor="invite-name">Nama Lengkap</Label>
            <Input
              id="invite-name"
              type="text"
              autoComplete="name"
              placeholder="Nama lengkap user"
              aria-invalid={errors.fullName ? 'true' : 'false'}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.fullName.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <Select
              value={roleSlug}
              onValueChange={(v) =>
                setValue('roleSlug', v, { shouldValidate: true })
              }
            >
              <SelectTrigger id="invite-role" aria-invalid={errors.roleSlug ? 'true' : 'false'}>
                <SelectValue placeholder={rolesQuery.isLoading ? 'Memuat…' : 'Pilih role'} />
              </SelectTrigger>
              <SelectContent>
                {(rolesQuery.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.slug}>
                    {r.nameId} ({r.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.roleSlug && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.roleSlug.message}
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
              Kirim Undangan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
