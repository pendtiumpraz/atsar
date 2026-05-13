// `<PendingPaymentCard />` — fast-approval card for the pending queue.
//
// Renders one pending payment with bukti thumbnail, summary fields, and two
// large action buttons:
//   - "Aktifkan" → SweetAlert confirm → POST /admin/payments/:id/confirm.
//     The API requires { tierId, billingCycle } so we accept the same tier
//     catalog used by `<ActivateDialog />` and prompt for selection inside
//     the confirm dialog.
//   - "Tolak"    → opens `<RejectDialog />` for a free-form reason.
//
// All copy is Indonesian (admin surface).

'use client'

import * as React from 'react'
import { ExternalLink, FileImage, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api, ApiClientError } from '@/lib/api/client'
import { MySwal } from '@/lib/swal'

import { ProofViewer } from './proof-viewer'
import { RejectDialog } from './reject-dialog'
import type {
  ActivateTierOption,
  BillingCycle,
} from '@/components/admin/subscriptions/activate-dialog'

type PaymentMethod = 'manual_transfer' | 'midtrans' | 'xendit'

export interface PendingPaymentCardData {
  id: string
  userId: string
  subscriptionId: string | null
  amountIdr: number
  method: PaymentMethod
  reference: string | null
  proofUrl: string | null
  createdAt: string
}

export interface PendingPaymentCardProps {
  payment: PendingPaymentCardData
  /** Paid tiers used to populate the confirm-tier dropdown. */
  tiers: ActivateTierOption[]
  /** Fired after the payment has been confirmed OR rejected so the parent
   * can drop it from the pending queue. */
  onResolved?: () => void
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  manual_transfer: 'Transfer Manual',
  midtrans: 'Midtrans',
  xendit: 'Xendit',
}

const ATHAR_SWAL_CLASSES = {
  popup: 'athar-swal-popup',
  title: 'athar-swal-title',
  htmlContainer: 'athar-swal-html',
  confirmButton: 'athar-swal-confirm',
  cancelButton: 'athar-swal-cancel',
  input: 'athar-swal-input',
  validationMessage: 'athar-swal-validation',
  actions: 'athar-swal-actions',
} as const

const ID_DATE_TIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function formatIdr(value: number): string {
  if (!Number.isFinite(value)) return 'Rp 0'
  return `Rp ${Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
}

function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return ID_DATE_TIME.format(date)
}

function shortId(value: string, head = 10): string {
  return value.length > head ? `${value.slice(0, head)}…` : value
}

function isImage(url: string | null | undefined): boolean {
  if (!url) return false
  const clean = url.split('?')[0]?.toLowerCase() ?? ''
  return /\.(png|jpe?g|webp|gif)$/.test(clean)
}

/**
 * Build the activation prompt as a SweetAlert with embedded tier + cycle
 * dropdowns. Returning `null` means the admin cancelled.
 */
async function promptActivation(opts: {
  paidTiers: ActivateTierOption[]
  amountIdr: number
  suggestTierId: string | null
}): Promise<{ tierId: string; billingCycle: BillingCycle } | null> {
  const { paidTiers, amountIdr, suggestTierId } = opts
  if (paidTiers.length === 0) {
    toast.error('Tidak ada tier berbayar tersedia di sistem.')
    return null
  }

  const tierOptions = paidTiers
    .map(
      (t) =>
        `<option value="${t.id}"${t.id === suggestTierId ? ' selected' : ''}>${
          t.nameId
        } (${t.slug})</option>`,
    )
    .join('')

  const result = await MySwal.fire({
    title: 'Aktifkan langganan?',
    html: `
      <div style="text-align:left;display:flex;flex-direction:column;gap:8px">
        <p style="margin:0">Nominal pembayaran <strong>${formatIdr(amountIdr)}</strong> akan dikonfirmasi dan langganan diaktifkan.</p>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem">
          <span>Tier</span>
          <select id="swal-tier" class="athar-swal-input" style="padding:6px">${tierOptions}</select>
        </label>
        <label style="display:flex;flex-direction:column;gap:4px;font-size:0.85rem">
          <span>Periode</span>
          <select id="swal-cycle" class="athar-swal-input" style="padding:6px">
            <option value="monthly">Bulanan</option>
            <option value="yearly">Tahunan</option>
          </select>
        </label>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Aktifkan',
    cancelButtonText: 'Batal',
    reverseButtons: true,
    customClass: ATHAR_SWAL_CLASSES,
    buttonsStyling: false,
    focusConfirm: false,
    preConfirm: () => {
      const tierEl = document.getElementById('swal-tier') as HTMLSelectElement | null
      const cycleEl = document.getElementById('swal-cycle') as HTMLSelectElement | null
      const tierId = tierEl?.value ?? ''
      const billingCycle = (cycleEl?.value as BillingCycle) ?? 'monthly'
      if (!tierId) {
        MySwal.showValidationMessage('Pilih tier terlebih dahulu.')
        return false
      }
      return { tierId, billingCycle }
    },
  })

  if (!result.isConfirmed || !result.value) return null
  return result.value as { tierId: string; billingCycle: BillingCycle }
}

export function PendingPaymentCard({
  payment,
  tiers,
  onResolved,
}: PendingPaymentCardProps) {
  const [confirming, setConfirming] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [proofOpen, setProofOpen] = React.useState(false)

  const paidTiers = React.useMemo(() => tiers.filter((t) => t.slug !== 'free'), [tiers])

  // Suggest the tier whose monthly OR yearly price exactly matches the
  // payment amount. Falls back to the first paid tier if nothing matches.
  const suggestedTierId = React.useMemo(() => {
    const exact = paidTiers.find(
      (t) =>
        t.priceMonthlyIdr === payment.amountIdr || t.priceYearlyIdr === payment.amountIdr,
    )
    return (exact ?? paidTiers[0])?.id ?? null
  }, [paidTiers, payment.amountIdr])

  async function handleConfirm() {
    const choice = await promptActivation({
      paidTiers,
      amountIdr: payment.amountIdr,
      suggestTierId: suggestedTierId,
    })
    if (!choice) return

    setConfirming(true)
    try {
      // The shared `paymentsApi.admin.confirm` helper posts an empty body, but
      // the API requires `{ tierId, billingCycle }`. Call directly so we don't
      // have to touch the out-of-scope endpoints file. Mark the request with
      // an idempotency key so retrying a flaky network click doesn't double-
      // activate the subscription.
      await api.post(`/admin/payments/${payment.id}/confirm`, choice, {
        idempotencyKey: `confirm-payment-${payment.id}`,
      })
      toast.success('Pembayaran disetujui dan langganan diaktifkan.')
      onResolved?.()
    } catch (err) {
      const msg = ApiClientError.is(err) ? err.message : 'Gagal mengaktifkan pembayaran.'
      toast.error(msg)
    } finally {
      setConfirming(false)
    }
  }

  const showThumbnail = isImage(payment.proofUrl)

  return (
    <>
      <Card className="flex h-full flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-xs text-[rgb(var(--text-muted))]">
                {shortId(payment.id, 8)}
              </p>
              <p className="truncate text-sm font-medium">
                <code className="text-xs">{shortId(payment.userId, 12)}</code>
              </p>
            </div>
            <Badge className="shrink-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
              Menunggu
            </Badge>
          </div>

          {/* Proof thumbnail */}
          <button
            type="button"
            onClick={() => setProofOpen(true)}
            disabled={!payment.proofUrl}
            aria-label="Lihat bukti pembayaran"
            className="group relative flex h-32 w-full items-center justify-center overflow-hidden rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] transition-colors hover:border-[rgb(var(--accent))] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {showThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={payment.proofUrl as string}
                alt="Bukti pembayaran"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs text-[rgb(var(--text-muted))]">
                <FileImage className="h-6 w-6" />
                {payment.proofUrl ? 'Klik untuk lihat bukti' : 'Tidak ada bukti'}
              </span>
            )}
            {payment.proofUrl ? (
              <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                Lihat
              </span>
            ) : null}
          </button>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-[rgb(var(--text-muted))]">Nominal</dt>
            <dd className="text-right font-semibold text-[rgb(var(--text))]">
              {formatIdr(payment.amountIdr)}
            </dd>

            <dt className="text-[rgb(var(--text-muted))]">Metode</dt>
            <dd className="truncate text-right">
              {METHOD_LABEL[payment.method] ?? payment.method}
            </dd>

            <dt className="text-[rgb(var(--text-muted))]">Referensi</dt>
            <dd className="truncate text-right" title={payment.reference ?? undefined}>
              {payment.reference ?? '—'}
            </dd>

            <dt className="text-[rgb(var(--text-muted))]">Dikirim</dt>
            <dd className="text-right">{formatDate(payment.createdAt)}</dd>
          </dl>

          <div className="mt-auto flex flex-col gap-2 pt-1">
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memproses…
                </>
              ) : (
                'Aktifkan'
              )}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={confirming}
                onClick={() => setRejectOpen(true)}
                className="flex-1 border-rose-400 text-rose-600 hover:bg-rose-50 dark:border-rose-500/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
              >
                Tolak
              </Button>
              {payment.proofUrl ? (
                <Button asChild variant="outline" size="icon" className="shrink-0">
                  <a
                    href={payment.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Buka bukti di tab baru"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProofViewer
        open={proofOpen}
        onOpenChange={setProofOpen}
        url={payment.proofUrl}
        title={`${shortId(payment.userId)} · ${formatIdr(payment.amountIdr)}`}
      />

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        paymentId={payment.id}
        label={`${shortId(payment.userId)} · ${formatIdr(payment.amountIdr)}`}
        onRejected={() => onResolved?.()}
      />
    </>
  )
}
