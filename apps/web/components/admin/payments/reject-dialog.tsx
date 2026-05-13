// `<RejectDialog />` — confirm + capture a rejection reason for a payment.
//
// Submits `POST /admin/payments/:id/reject` with `{ reason }`. The API
// records the reason on the linked subscription's `notes` so the user can
// see why their bukti was rejected.
//
// All copy is Indonesian (admin surface).

'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { paymentsApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'

export interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentId: string | null
  /** Short user-facing label rendered in the dialog header (email / id). */
  label?: string
  /** Fired after a successful rejection so the parent can refresh data. */
  onRejected?: () => void
}

const MAX_REASON = 500

export function RejectDialog({
  open,
  onOpenChange,
  paymentId,
  label,
  onRejected,
}: RejectDialogProps) {
  const [reason, setReason] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // Clear the textarea every time the dialog opens for a new payment so we
  // never accidentally submit a stale reason for a different bukti.
  React.useEffect(() => {
    if (open) setReason('')
  }, [open, paymentId])

  const trimmed = reason.trim()
  const tooLong = trimmed.length > MAX_REASON
  const canSubmit = !submitting && trimmed.length >= 1 && !tooLong && !!paymentId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentId || !canSubmit) return
    setSubmitting(true)
    try {
      await paymentsApi.admin.reject(paymentId, trimmed)
      toast.success('Pembayaran ditolak. Catatan terkirim ke pengguna.')
      onRejected?.()
      onOpenChange(false)
    } catch (err) {
      const msg = ApiClientError.is(err) ? err.message : 'Gagal menolak pembayaran.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tolak Pembayaran</DialogTitle>
          <DialogDescription>
            Tulis alasan penolakan untuk{' '}
            <span className="font-medium">{label ?? 'pembayaran ini'}</span>. Alasan akan
            ditampilkan ke pengguna pada halaman tagihan mereka.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Alasan penolakan</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Nominal transfer tidak sesuai dengan paket yang dipilih."
              rows={4}
              maxLength={MAX_REASON + 50}
              aria-invalid={tooLong ? 'true' : 'false'}
              disabled={submitting}
            />
            <p className="flex items-center justify-between text-xs text-[rgb(var(--text-muted))]">
              <span>Wajib diisi. Minimal 1 karakter.</span>
              <span className={tooLong ? 'font-medium text-rose-600' : undefined}>
                {trimmed.length}/{MAX_REASON}
              </span>
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses…
                </>
              ) : (
                'Tolak Pembayaran'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
