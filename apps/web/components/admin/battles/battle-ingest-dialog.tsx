// `<BattleIngestDialog />` — the "Tambah Perang (AI)" modal form.
//
// Captures the battle name + (optional) type + (optional) hint note. The
// parent owns the actual mutation so this component stays pure: it just
// calls `onSubmit(values)` with whatever passed local validation.
//
// Mirrors `<FigureIngestDialog />`.

'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Sparkles } from 'lucide-react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const TYPE_OPTIONS: { value: 'ghazwah' | 'sariyyah' | 'futuhat'; label: string }[] = [
  { value: 'ghazwah', label: 'Ghazwah (Nabi ﷺ memimpin)' },
  { value: 'sariyyah', label: 'Sariyyah (delegasi sahabat)' },
  { value: 'futuhat', label: 'Futuhat (penaklukan pasca-Nabi)' },
]

const formSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(160),
  type: z.enum(['ghazwah', 'sariyyah', 'futuhat']).optional(),
  hints: z.string().trim().max(2000).optional(),
})

type FormValues = z.input<typeof formSchema>

const DEFAULTS: FormValues = {
  name: '',
  type: undefined,
  hints: '',
}

export interface BattleIngestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: { name: string; type?: string; hints?: string }) => void
  submitting: boolean
}

export function BattleIngestDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: BattleIngestDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULTS,
  })

  useEffect(() => {
    if (open) reset(DEFAULTS)
  }, [open, reset])

  const type = watch('type')

  function submit(values: FormValues) {
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) return
    const data = parsed.data
    onSubmit({
      name: data.name,
      ...(data.type ? { type: data.type } : {}),
      ...(data.hints && data.hints.length > 0 ? { hints: data.hints } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" />
            Tambah Perang (AI)
          </DialogTitle>
          <DialogDescription>
            Asisten akan mengambil fakta hanya dari domain whitelist (mis.
            dorar.net, islamweb.net) dan menyertakan kutipan per fakta.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nama perang</Label>
            <Input
              id="name"
              placeholder="contoh: Perang Badar"
              autoComplete="off"
              aria-invalid={errors.name ? 'true' : 'false'}
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Jenis (opsional)</Label>
            <Select
              value={type ?? ''}
              onValueChange={(v) =>
                setValue('type', v === '' ? undefined : (v as FormValues['type']))
              }
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Biarkan AI tentukan" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hints">Petunjuk tambahan (opsional)</Label>
            <Textarea
              id="hints"
              rows={3}
              placeholder='Misal: "tahun 2 H, pasukan 313 sahabat melawan kafir Quraisy"'
              aria-invalid={errors.hints ? 'true' : 'false'}
              {...register('hints')}
            />
            {errors.hints && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.hints.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Mulai Riset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
