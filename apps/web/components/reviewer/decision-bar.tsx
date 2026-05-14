// Sticky decision bar for the review page (WIREFRAMES §27 footer).
//
// Three actions, each posting to a different endpoint:
//   - Setuju & Terbitkan  → /reviewer/assignments/[id]/approve     (optional edits)
//   - Minta Perbaikan     → /reviewer/assignments/[id]/request-edit (with reason)
//   - Tolak               → /reviewer/assignments/[id]/reject       (with reason)
//
// Reviewer edits — when the right-pane form was modified — ride along on the
// /approve POST as `{ edits: { ... } }`. The backend then writes them as a
// NEW `content_revisions` row (action='edited_manual') BEFORE the approval
// revision, preserving the original AI draft for audit.
//
// Keyboard shortcuts (printable letters when no input is focused):
//   A → Setuju & Terbitkan (with confirmation)
//   R → Minta Perbaikan
//   X → Tolak
//
// All flows end with: success toast → `router.replace('/queue')`. We use
// `replace` (not `push`) so the back button doesn't bounce the reviewer
// back into a finalized assignment.

'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { openAiEditModal } from '@/components/reviewer/ai-edit-modal'
import { useReviewerEdits } from '@/components/reviewer/review-workspace'
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
    title: 'Tolak konten',
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
    confirmButtonText: 'Tolak',
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

async function promptApprovalConfirmation(args: {
  contentLabel?: string
  isDirty: boolean
}): Promise<boolean> {
  const html = args.isDirty
    ? `Anda telah mengedit draf. Konten <strong>akan dipublikasikan</strong> dengan koreksi Anda. Versi asli AI tetap tersimpan di riwayat revisi.`
    : `Konten <strong>akan dipublikasikan</strong> apa adanya tanpa perubahan dari draf AI.`
  const result = await MySwal.fire({
    title: `Setujui & Terbitkan${args.contentLabel ? `: ${args.contentLabel}` : ''}?`,
    html,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Ya, Terbitkan',
    cancelButtonText: 'Batal',
    reverseButtons: true,
    focusConfirm: true,
    customClass: ATHAR_CLASSES,
    buttonsStyling: false,
  })
  return Boolean(result.isConfirmed)
}

export function DecisionBar({ assignmentId, contentLabel, className }: DecisionBarProps) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action>(null)
  const editsCtx = useReviewerEdits()
  const hasEdits = Boolean(editsCtx?.isDirty)

  const disabled = busy !== null

  const handleApprove = useCallback(async () => {
    const ok = await promptApprovalConfirmation({ contentLabel, isDirty: hasEdits })
    if (!ok) return
    setBusy('approve')
    try {
      const body = hasEdits && editsCtx ? { edits: editsCtx.edits } : {}
      await api.post(`/reviewer/assignments/${assignmentId}/approve`, body)
      toast.success('Konten disetujui dan dipublikasikan.')
      router.replace('/queue')
      router.refresh()
    } catch (err) {
      const message = ApiClientError.is(err) ? err.message : 'Gagal menyetujui konten.'
      toast.error(message)
      setBusy(null)
    }
  }, [assignmentId, contentLabel, editsCtx, hasEdits, router])

  const handleReject = useCallback(async () => {
    const reason = await promptRejectionReason()
    if (!reason) return
    setBusy('reject')
    try {
      await api.post(`/reviewer/assignments/${assignmentId}/reject`, { reason })
      toast.success('Konten ditolak.')
      router.replace('/queue')
      router.refresh()
    } catch (err) {
      const message = ApiClientError.is(err) ? err.message : 'Gagal menolak konten.'
      toast.error(message)
      setBusy(null)
    }
  }, [assignmentId, router])

  const handleRequestEdit = useCallback(async () => {
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
  }, [assignmentId, contentLabel, router])

  // ── Keyboard shortcuts ───────────────────────────────────────────
  // A / R / X trigger the three actions. We skip while a textarea or input is
  // focused (the reviewer is editing) and while a SweetAlert modal is open
  // (otherwise the same letter would fire the action twice).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (target?.isContentEditable) return
      // SweetAlert renders a `.swal2-container` overlay — bail if it's open.
      if (typeof document !== 'undefined' && document.querySelector('.swal2-container')) {
        return
      }
      if (disabled) return
      const key = e.key.toLowerCase()
      if (key === 'a') {
        e.preventDefault()
        void handleApprove()
      } else if (key === 'r') {
        e.preventDefault()
        void handleRequestEdit()
      } else if (key === 'x') {
        e.preventDefault()
        void handleReject()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [disabled, handleApprove, handleRequestEdit, handleReject])

  return (
    <div
      className={cn(
        'sticky bottom-0 z-30 -mx-4 mt-6 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface))]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6',
        className,
      )}
      role="toolbar"
      aria-label="Keputusan review"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
          <span className="hidden sm:inline">Pintasan keyboard:</span>
          <kbd className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-[10px]">
            A
          </kbd>
          <span>setuju</span>
          <span className="opacity-40">·</span>
          <kbd className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-[10px]">
            R
          </kbd>
          <span>minta perbaikan</span>
          <span className="opacity-40">·</span>
          <kbd className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-[10px]">
            X
          </kbd>
          <span>tolak</span>
          {hasEdits ? (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              ✎ ada koreksi
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={handleReject}
            className="border-rose-400 text-rose-600 hover:bg-rose-50 dark:border-rose-500/60 dark:text-rose-300 dark:hover:bg-rose-950/30"
          >
            {busy === 'reject' ? 'Memproses…' : '✗ Tolak'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={handleRequestEdit}
            className="border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-500/60 dark:text-amber-300 dark:hover:bg-amber-950/30"
          >
            {busy === 'request_edit' ? 'Memproses…' : '✎ Minta Perbaikan'}
          </Button>
          <Button
            type="button"
            disabled={disabled}
            onClick={handleApprove}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {busy === 'approve' ? 'Memproses…' : '✓ Setuju & Terbitkan'}
          </Button>
        </div>
      </div>
    </div>
  )
}
