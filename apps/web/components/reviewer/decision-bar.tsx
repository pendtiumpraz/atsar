// Sticky decision bar for the review page (WIREFRAMES §27 footer).
//
// Three actions, each posting to a different endpoint:
//   - Approve       → /reviewer/assignments/[id]/approve   (no body)
//   - Request Edit  → /reviewer/assignments/[id]/request-edit (modal)
//   - Reject        → /reviewer/assignments/[id]/reject    (with reason)
//
// All flows end with: success toast → `router.replace('/queue')`. We use
// `replace` (not `push`) so the back button doesn't bounce the reviewer
// back into a finalized assignment.

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { openAiEditModal } from '@/components/reviewer/ai-edit-modal'
import { api, ApiClientError } from '@/lib/api/client'
import { MySwal } from '@/lib/swal'
import { cn } from '@/lib/utils'

const ATHAR_CLASSES = {
  popup: 'athar-swal-popup',
  title: 'athar-swal-title',
  htmlContainer: 'athar-swal-html',
  confirmButton: 'athar-swal-confirm',
  cancelButton: 'athar-swal-cancel',
  actions: 'athar-swal-actions',
} as const

export interface DecisionBarProps {
  assignmentId: string
  /** Title of the content being reviewed (passed to the AI edit modal). */
  contentLabel?: string
  className?: string
}

type Action = 'approve' | 'reject' | 'request_edit' | null

async function promptRejectionReason(): Promise<string | null> {
  const result = await MySwal.fire({
    title: 'Reject konten',
    text: 'Tulis alasan penolakan agar admin / penulis bisa menindaklanjuti.',
    input: 'textarea',
    inputPlaceholder: 'Contoh: Sumber primer kurang, referensi hanya dari blog.',
    inputAttributes: { 'aria-label': 'Alasan penolakan' },
    inputValidator: (value) => {
      const trimmed = (value ?? '').trim()
      if (trimmed.length === 0) return 'Alasan tidak boleh kosong.'
      if (trimmed.length > 4000) return 'Alasan terlalu panjang (max 4000 karakter).'
      return null
    },
    showCancelButton: true,
    confirmButtonText: 'Reject',
    cancelButtonText: 'Batal',
    reverseButtons: true,
    focusCancel: true,
    customClass: ATHAR_CLASSES,
    buttonsStyling: false,
  })
  if (result.isConfirmed && typeof result.value === 'string') {
    return result.value.trim()
  }
  return null
}

export function DecisionBar({ assignmentId, contentLabel, className }: DecisionBarProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action>(null)

  const disabled = busy !== null

  const handleApprove = async () => {
    setBusy('approve')
    try {
      await api.post(`/reviewer/assignments/${assignmentId}/approve`, {})
      toast.success('Konten disetujui dan dipublikasikan.')
      router.replace('/queue')
      router.refresh()
    } catch (err) {
      const message = ApiClientError.is(err) ? err.message : 'Gagal approve konten.'
      toast.error(message)
      setBusy(null)
    }
  }

  const handleReject = async () => {
    const reason = await promptRejectionReason()
    if (!reason) return
    setBusy('reject')
    try {
      await api.post(`/reviewer/assignments/${assignmentId}/reject`, { reason })
      toast.success('Konten ditolak.')
      router.replace('/queue')
      router.refresh()
    } catch (err) {
      const message = ApiClientError.is(err) ? err.message : 'Gagal reject konten.'
      toast.error(message)
      setBusy(null)
    }
  }

  const handleRequestEdit = async () => {
    setBusy('request_edit')
    const submitted = await openAiEditModal({
      assignmentId,
      contentLabel,
      onSubmitted: () => {
        router.replace('/queue')
        router.refresh()
      },
    })
    if (!submitted) setBusy(null)
  }

  return (
    <div
      className={cn(
        'sticky bottom-0 z-30 -mx-4 mt-6 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6',
        className,
      )}
      role="toolbar"
      aria-label="Keputusan review"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={handleReject}
          className="border-rose-400 text-rose-600 hover:bg-rose-50 dark:border-rose-500/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          ✗ Reject
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={handleRequestEdit}
        >
          ✎ Request Edit
        </Button>
        <Button
          type="button"
          disabled={disabled}
          onClick={handleApprove}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {busy === 'approve' ? 'Memproses…' : '✓ Approve'}
        </Button>
      </div>
    </div>
  )
}
