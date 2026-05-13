// `<AddDomainDialog />` — modal form to create a new whitelist domain.
//
// Owns its own form state with `react-hook-form` + `zod` so the parent table
// only learns about success through `onCreated`.  The schema mirrors the
// backend Zod schema in `app/api/v1/admin/whitelist/route.ts` so the user
// gets local errors before the round-trip.
//
// `domain` accepts either a raw hostname (`shamela.ws`) or a full URL
// (`https://shamela.ws/foo`); we strip the protocol + path client-side before
// POSTing so the server-side regex sees a clean hostname.

'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, ApiClientError } from '@/lib/api/client'

const HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/

/**
 * Best-effort hostname extraction.  Accepts a full URL, a `host/path`
 * shorthand, or a bare hostname — strips anything that isn't the host.
 */
function normaliseDomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (trimmed.length === 0) return trimmed
  try {
    const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`
    const url = new URL(withScheme)
    return url.hostname
  } catch {
    return trimmed
  }
}

const formSchema = z.object({
  domain: z
    .string()
    .min(1, 'Domain wajib diisi')
    .transform(normaliseDomain)
    .refine((v) => v.length > 0 && v.length <= 253, 'Domain terlalu panjang')
    .refine((v) => HOSTNAME_REGEX.test(v), 'Domain tidak valid (mis. shamela.ws)'),
  displayName: z.string().trim().max(160).optional(),
  primaryLanguage: z.enum(['ar', 'id', 'en']).optional(),
  description: z.string().trim().max(2000).optional(),
  priority: z.coerce.number().int().min(1).max(10).default(5),
  crawlRatePerMinute: z.coerce.number().int().min(1).max(600).default(30),
})

type FormValues = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

export interface AddDomainDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

const DEFAULTS: FormValues = {
  domain: '',
  displayName: '',
  primaryLanguage: undefined,
  description: '',
  priority: 5,
  crawlRatePerMinute: 30,
}

export function AddDomainDialog({ open, onOpenChange, onCreated }: AddDomainDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULTS,
  })

  // Re-init the form every time the dialog opens so a previous failed attempt
  // doesn't bleed into a fresh session.
  useEffect(() => {
    if (open) reset(DEFAULTS)
  }, [open, reset])

  const primaryLanguage = watch('primaryLanguage')

  async function onSubmit(values: FormValues) {
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) return
    const body = parsed.data as FormOutput

    try {
      await api.post('/admin/whitelist', {
        domain: body.domain,
        displayName: body.displayName ? body.displayName : null,
        primaryLanguage: body.primaryLanguage ?? null,
        description: body.description ? body.description : null,
        priority: body.priority,
        crawlRatePerMinute: body.crawlRatePerMinute,
      })
      toast.success('Domain ditambahkan')
      onCreated?.()
      onOpenChange(false)
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          setError(field as keyof FormValues, { message })
        }
        toast.error(err.message)
        return
      }
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan domain'
      toast.error(msg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Domain</DialogTitle>
          <DialogDescription>
            Domain yang ditambahkan boleh digunakan sebagai sumber kutipan oleh asisten riset Atsar.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              placeholder="contoh: shamela.ws"
              autoComplete="off"
              aria-invalid={errors.domain ? 'true' : 'false'}
              {...register('domain')}
            />
            {errors.domain && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.domain.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Nama tampilan</Label>
            <Input
              id="displayName"
              placeholder="Al-Maktabah al-Shamela"
              aria-invalid={errors.displayName ? 'true' : 'false'}
              {...register('displayName')}
            />
            {errors.displayName && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.displayName.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="primaryLanguage">Bahasa utama</Label>
              <Select
                value={primaryLanguage}
                onValueChange={(v) => setValue('primaryLanguage', v as 'ar' | 'id' | 'en')}
              >
                <SelectTrigger id="primaryLanguage">
                  <SelectValue placeholder="Pilih bahasa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">Arab</SelectItem>
                  <SelectItem value="id">Indonesia</SelectItem>
                  <SelectItem value="en">Inggris</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioritas (1–10)</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={10}
                aria-invalid={errors.priority ? 'true' : 'false'}
                {...register('priority')}
              />
              {errors.priority && (
                <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                  {errors.priority.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="crawlRatePerMinute">Laju crawl / menit</Label>
            <Input
              id="crawlRatePerMinute"
              type="number"
              min={1}
              max={600}
              aria-invalid={errors.crawlRatePerMinute ? 'true' : 'false'}
              {...register('crawlRatePerMinute')}
            />
            {errors.crawlRatePerMinute && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.crawlRatePerMinute.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              rows={3}
              placeholder="Catatan internal mengenai sumber ini"
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
