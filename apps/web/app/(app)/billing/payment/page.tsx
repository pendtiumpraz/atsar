'use client'

// Payment form — `/billing/payment`.
//
// Upload bukti transfer + reference + amount → POST /api/v1/payments.
// Activation is manual (admin reviews + confirms), so we communicate that
// expectation up-front and display the pending status after submission.
//
// File is uploaded as multipart/form-data so the API can persist it via
// the standard /uploads pipeline. If the backend prefers a JSON payload
// with an already-uploaded URL, this is the single place to swap.

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { CheckCircle2, FileUp, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { api, ApiClientError } from '@/lib/api/client'

const MAX_FILE_MB = 5
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

const paymentSchema = z.object({
  reference: z
    .string()
    .min(3, 'Referensi minimal 3 karakter')
    .max(120, 'Referensi maksimal 120 karakter'),
  amount: z
    .number({ invalid_type_error: 'Nominal wajib angka' })
    .int('Nominal harus bilangan bulat')
    .positive('Nominal harus lebih dari 0'),
  note: z.string().max(500, 'Maksimal 500 karakter').optional().or(z.literal('')),
})

type PaymentValues = z.infer<typeof paymentSchema>

const ADMIN_WA_NUMBER = '6281319504400'
const ADMIN_WA_URL = `https://wa.me/${ADMIN_WA_NUMBER}`

export default function BillingPaymentPage() {
  const [file, setFile] = React.useState<File | null>(null)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [pending, setPending] = React.useState<{ id?: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { reference: '', amount: 0, note: '' },
  })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0] ?? null
    setFileError(null)
    if (!next) {
      setFile(null)
      return
    }
    if (!ACCEPTED.includes(next.type)) {
      setFileError('Format harus PNG, JPG, WEBP, atau PDF')
      setFile(null)
      return
    }
    if (next.size > MAX_FILE_BYTES) {
      setFileError(`Ukuran maksimal ${MAX_FILE_MB} MB`)
      setFile(null)
      return
    }
    setFile(next)
  }

  async function onSubmit(values: PaymentValues) {
    if (!file) {
      setFileError('Bukti pembayaran wajib diunggah')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('reference', values.reference)
      fd.append('amount', String(values.amount))
      if (values.note) fd.append('note', values.note)

      const res = await api.post<{ id?: string }>('/payments', fd)
      toast.success('Bukti pembayaran terkirim. Menunggu verifikasi admin.')
      setPending({ id: res?.id })
      reset()
      setFile(null)
    } catch (e) {
      const msg = ApiClientError.is(e)
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Gagal mengirim bukti pembayaran'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Pembayaran
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Unggah bukti transfer untuk aktivasi langganan. Aktivasi dilakukan secara
          manual oleh admin setelah verifikasi.
        </p>
      </header>

      {pending ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="mt-0.5 h-5 w-5"
                style={{ color: 'rgb(var(--primary))' }}
              />
              <div>
                <p className="font-medium">Bukti pembayaran diterima</p>
                <p className="text-sm text-[rgb(var(--text-muted))]">
                  Status: <span className="font-medium">Menunggu verifikasi</span>
                  {pending.id ? ` · ID #${pending.id}` : null}
                </p>
                <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
                  Anda akan menerima notifikasi setelah pembayaran diverifikasi.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPending(null)}
            >
              Kirim bukti lain
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Form Pembayaran</CardTitle>
            <CardDescription>
              Pastikan nominal dan referensi sesuai dengan transfer Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
              {/* File */}
              <div className="space-y-2">
                <Label htmlFor="file">Bukti pembayaran</Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="file"
                    type="file"
                    accept={ACCEPTED.join(',')}
                    onChange={handleFile}
                  />
                  {file ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-muted))]">
                      <FileUp className="h-3.5 w-3.5" />
                      {file.name}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  PNG, JPG, WEBP, atau PDF. Maks {MAX_FILE_MB} MB.
                </p>
                {fileError && (
                  <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                    {fileError}
                  </p>
                )}
              </div>

              {/* Reference */}
              <div className="space-y-2">
                <Label htmlFor="reference">Referensi pembayaran</Label>
                <Input
                  id="reference"
                  type="text"
                  placeholder="No. referensi transfer / rekening pengirim"
                  aria-invalid={errors.reference ? 'true' : 'false'}
                  {...register('reference')}
                />
                {errors.reference && (
                  <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                    {errors.reference.message}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Nominal (IDR)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="299000"
                  aria-invalid={errors.amount ? 'true' : 'false'}
                  {...register('amount', { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                    {errors.amount.message}
                  </p>
                )}
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note">Catatan (opsional)</Label>
                <Input
                  id="note"
                  type="text"
                  placeholder="Pesan untuk admin"
                  aria-invalid={errors.note ? 'true' : 'false'}
                  {...register('note')}
                />
                {errors.note && (
                  <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                    {errors.note.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    'Kirim bukti pembayaran'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 text-sm text-[rgb(var(--text-muted))]">
          <p className="font-medium text-[rgb(var(--text))]">Bantuan</p>
          <p className="mt-1">
            Untuk pertanyaan terkait pembayaran, hubungi admin (Galih) via WhatsApp di{' '}
            <a
              href={ADMIN_WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: 'rgb(var(--accent))' }}
            >
              0813-1950-4400
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
