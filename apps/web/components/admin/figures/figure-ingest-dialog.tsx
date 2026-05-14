// `<FigureIngestDialog />` — the "Tambah Tokoh (AI)" modal form.
//
// Captures the figure name + category + (optional) gender + (optional) hint
// note. The parent owns the actual mutation so this component stays pure:
// it just calls `onSubmit(values)` with whatever passed local validation.

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

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'nabi', label: 'Nabi' },
  { value: 'sahabat', label: 'Sahabat' },
  { value: 'tabiin', label: 'Tabiʻin' },
  { value: 'tabiut_tabiin', label: 'Tabiʻut Tabiʻin' },
  { value: 'shalih_pasca_rasul', label: 'Shalih pasca Rasul' },
  { value: 'shalih_pre_rasul', label: 'Shalih pra Rasul' },
]

const formSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(160),
  category: z.enum([
    'nabi',
    'sahabat',
    'tabiin',
    'tabiut_tabiin',
    'shalih_pasca_rasul',
    'shalih_pre_rasul',
  ]),
  gender: z.enum(['male', 'female']).optional(),
  hints: z.string().trim().max(2000).optional(),
})

type FormValues = z.input<typeof formSchema>

const DEFAULTS: FormValues = {
  name: '',
  category: 'sahabat',
  gender: undefined,
  hints: '',
}

export interface FigureIngestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: {
    name: string
    category: string
    gender?: string
    hints?: string
  }) => void
  submitting: boolean
}

export function FigureIngestDialog({
  open,
  onOpenChange,
  onSubmit,
  submitting,
}: FigureIngestDialogProps) {
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

  const category = watch('category')
  const gender = watch('gender')

  function submit(values: FormValues) {
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) return
    const data = parsed.data
    onSubmit({
      name: data.name,
      category: data.category,
      ...(data.gender ? { gender: data.gender } : {}),
      ...(data.hints && data.hints.length > 0 ? { hints: data.hints } : {}),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[rgb(var(--accent))]" />
            Tambah Tokoh (AI)
          </DialogTitle>
          <DialogDescription>
            Asisten akan mengambil fakta hanya dari domain whitelist (mis.
            islamqa.info, dorar.net) dan menyertakan kutipan per fakta.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="name">Nama tokoh</Label>
            <Input
              id="name"
              placeholder="contoh: Imam Bukhari"
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="category">Kategori</Label>
              <Select value={category} onValueChange={(v) => setValue('category', v as FormValues['category'])}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                  {errors.category.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Jenis kelamin</Label>
              <Select
                value={gender ?? ''}
                onValueChange={(v) => setValue('gender', v === '' ? undefined : (v as 'male' | 'female'))}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Otomatis dari sumber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Laki-laki</SelectItem>
                  <SelectItem value="female">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hints">Petunjuk tambahan (opsional)</Label>
            <Textarea
              id="hints"
              rows={3}
              placeholder="Misal: fokuskan pada tahun wafat dan guru utama. Jangan campur dengan tokoh lain bernama sama."
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
