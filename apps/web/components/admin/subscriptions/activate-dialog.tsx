// `<ActivateDialog />` — admin form for manually activating a subscription.
//
// Posts `POST /admin/subscriptions/:id/activate` with `{ tierId, billingCycle }`
// after manual payment verification. The notes textarea is kept for the
// admin's convenience even though the API doesn't persist it today — it's a
// no-cost UX nicety so the workflow matches the team's existing checklist.
//
// Tier list is supplied via props because there is no public tier endpoint;
// the server page that mounts this dialog loads tiers from the DB and passes
// them down.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { subscriptionsApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'

export type BillingCycle = 'monthly' | 'yearly'

export interface ActivateTierOption {
  id: string
  slug: string
  nameId: string
  priceMonthlyIdr: number
  priceYearlyIdr: number
}

export interface ActivateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Subscription row id being activated. */
  subscriptionId: string | null
  /** Short label for the dialog header (user email / id). */
  label?: string
  /** Default tier id selected when the dialog opens. */
  defaultTierId?: string
  /** Default billing cycle selected when the dialog opens. */
  defaultBillingCycle?: BillingCycle
  /** Tiers eligible for activation (excluding `free`). */
  tiers: ActivateTierOption[]
  /** Fired after a successful activation so the caller can refresh. */
  onActivated?: () => void
}

function formatIdr(value: number): string {
  // Locale-independent grouping with dots to match the brand convention
  // (`Rp 299.000`). We avoid `Intl.NumberFormat('id-ID')` so the output is
  // deterministic across server-rendered and client-rendered surfaces.
  if (!Number.isFinite(value)) return 'Rp 0'
  return `Rp ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

export function ActivateDialog({
  open,
  onOpenChange,
  subscriptionId,
  label,
  defaultTierId,
  defaultBillingCycle = 'monthly',
  tiers,
  onActivated,
}: ActivateDialogProps) {
  // Pick the first non-free tier as a sensible default if the caller didn't
  // supply one (or supplied the free tier — activation is paid-only).
  const paidTiers = React.useMemo(() => tiers.filter((t) => t.slug !== 'free'), [tiers])
  const fallbackTierId = React.useMemo(() => {
    if (defaultTierId && paidTiers.some((t) => t.id === defaultTierId)) {
      return defaultTierId
    }
    return paidTiers[0]?.id ?? ''
  }, [defaultTierId, paidTiers])

  const [tierId, setTierId] = React.useState<string>(fallbackTierId)
  const [billingCycle, setBillingCycle] =
    React.useState<BillingCycle>(defaultBillingCycle)
  const [notes, setNotes] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  // Reset state whenever the dialog opens for a (potentially) different
  // subscription so we never submit stale values.
  React.useEffect(() => {
    if (!open) return
    setTierId(fallbackTierId)
    setBillingCycle(defaultBillingCycle)
    setNotes('')
  }, [open, subscriptionId, fallbackTierId, defaultBillingCycle])

  const selectedTier = React.useMemo(
    () => paidTiers.find((t) => t.id === tierId) ?? null,
    [paidTiers, tierId],
  )

  const previewPrice = selectedTier
    ? billingCycle === 'yearly'
      ? selectedTier.priceYearlyIdr
      : selectedTier.priceMonthlyIdr
    : 0

  const canSubmit = !submitting && !!subscriptionId && !!tierId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || !subscriptionId) return
    setSubmitting(true)
    try {
      await subscriptionsApi.admin.activate(subscriptionId, {
        tierId,
        billingCycle,
      })
      toast.success('Langganan diaktifkan.')
      onActivated?.()
      onOpenChange(false)
    } catch (err) {
      const msg = ApiClientError.is(err) ? err.message : 'Gagal mengaktifkan langganan.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aktivasi Langganan</DialogTitle>
          <DialogDescription>
            Aktifkan paket berbayar untuk{' '}
            <span className="font-medium">{label ?? 'pengguna ini'}</span> setelah
            verifikasi pembayaran manual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tier */}
          <div className="space-y-2">
            <Label htmlFor="activate-tier">Paket (Tier)</Label>
            <Select value={tierId} onValueChange={setTierId} disabled={submitting}>
              <SelectTrigger id="activate-tier">
                <SelectValue placeholder="Pilih tier…" />
              </SelectTrigger>
              <SelectContent>
                {paidTiers.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    Tidak ada tier berbayar tersedia
                  </SelectItem>
                ) : (
                  paidTiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.nameId}{' '}
                      <span className="text-xs text-[rgb(var(--text-muted))]">
                        ({tier.slug})
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Billing cycle */}
          <div className="space-y-2">
            <Label htmlFor="activate-cycle">Periode Penagihan</Label>
            <Select
              value={billingCycle}
              onValueChange={(v) => setBillingCycle(v as BillingCycle)}
              disabled={submitting}
            >
              <SelectTrigger id="activate-cycle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Bulanan</SelectItem>
                <SelectItem value="yearly">Tahunan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="activate-notes">Catatan internal (opsional)</Label>
            <Textarea
              id="activate-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mis. referensi bukti transfer, follow-up via WhatsApp Galih, dst."
              rows={3}
              disabled={submitting}
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Catatan ini hanya untuk dokumentasi admin (tidak dikirim ke pengguna).
            </p>
          </div>

          {selectedTier ? (
            <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-sm">
              <p className="font-medium text-[rgb(var(--text))]">
                {selectedTier.nameId} ·{' '}
                {billingCycle === 'yearly' ? 'tahunan' : 'bulanan'}
              </p>
              <p className="text-[rgb(var(--text-muted))]">
                Nominal: <span className="font-medium">{formatIdr(previewPrice)}</span>
              </p>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mengaktifkan…
                </>
              ) : (
                'Aktifkan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
