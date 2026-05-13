// AI-assisted edit modal (WIREFRAMES §28).
//
// The reviewer writes a natural-language instruction in Indonesian; we POST
// it to `/api/v1/reviewer/assignments/[id]/request-edit`. The backend currently
// only enqueues the job (see review.service.ts NOTE), so the UX is:
//
//   1. Modal with textarea + Submit.
//   2. On submit: show a "AI sedang memproses revisi" placeholder, fire the
//      POST, then close the modal and surface a toast.
//   3. Caller is expected to navigate away (decision-bar redirects to /queue
//      after a successful request).
//
// We use the existing `MySwal` SweetAlert wrapper from `@/lib/swal` to match
// the rest of the app — but we render our own JSX body so the textarea can be
// styled and bound to React state cleanly.

'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { MySwal } from '@/lib/swal'
import { api, ApiClientError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const ATHAR_CLASSES = {
  popup: 'athar-swal-popup',
  title: 'athar-swal-title',
  htmlContainer: 'athar-swal-html',
  confirmButton: 'athar-swal-confirm',
  cancelButton: 'athar-swal-cancel',
  actions: 'athar-swal-actions',
} as const

interface ModalBodyProps {
  initial: string
  onChange: (value: string) => void
  /** Title of the content being edited (for context). */
  contentLabel?: string
}

function ModalBody({ initial, onChange, contentLabel }: ModalBodyProps) {
  const [value, setValue] = useState(initial)

  return (
    <div className="flex flex-col gap-2 text-left">
      {contentLabel ? (
        <p className="text-xs text-[rgb(var(--text-muted))]">
          Konten: <span className="font-medium">{contentLabel}</span>
        </p>
      ) : null}
      <label
        htmlFor="ai-edit-instruction"
        className="text-sm text-[rgb(var(--text))]"
      >
        Tulis instruksi untuk AI dalam bahasa natural:
      </label>
      <textarea
        id="ai-edit-instruction"
        autoFocus
        rows={6}
        defaultValue={initial}
        onChange={(e) => {
          setValue(e.target.value)
          onChange(e.target.value)
        }}
        placeholder="Contoh: Tambahkan informasi tentang perang Yarmuk di bagian akhir. Ganti 'beliau berkata' menjadi 'beliau RA berkata'."
        className={cn(
          'min-h-[160px] w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm',
          'text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-faint))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
        )}
      />
      <p className="text-xs text-[rgb(var(--text-muted))]">
        AI akan menerapkan instruksi ini ke konten. Karakter: {value.length} / 8000
      </p>
    </div>
  )
}

export interface AiEditModalOptions {
  assignmentId: string
  /** Pre-filled instruction (rare — defaults to empty). */
  initial?: string
  /** Optional title of the content being edited. */
  contentLabel?: string
  /** Called after successful submission so the page can navigate away. */
  onSubmitted?: () => void
}

/**
 * Open the modal and resolve with `true` once the instruction has been
 * submitted successfully. Resolves with `false` on cancel.
 */
export async function openAiEditModal(opts: AiEditModalOptions): Promise<boolean> {
  // Capture textarea value in a closure so the swal preConfirm reads the
  // current state (swal renders the JSX outside React's reconciler tree, so
  // useState lives, but we still need a ref-equivalent capture).
  let instruction = opts.initial ?? ''

  const result = await MySwal.fire({
    title: `Request Edit AI`,
    html: (
      <ModalBody
        initial={instruction}
        contentLabel={opts.contentLabel}
        onChange={(v) => {
          instruction = v
        }}
      />
    ),
    showCancelButton: true,
    confirmButtonText: '✨ Submit ke AI',
    cancelButtonText: 'Batal',
    reverseButtons: true,
    focusConfirm: false,
    customClass: ATHAR_CLASSES,
    buttonsStyling: false,
    preConfirm: async () => {
      const trimmed = instruction.trim()
      if (trimmed.length === 0) {
        MySwal.showValidationMessage('Instruksi tidak boleh kosong.')
        return false
      }
      if (trimmed.length > 8000) {
        MySwal.showValidationMessage('Instruksi terlalu panjang (max 8000 karakter).')
        return false
      }
      try {
        await api.post(
          `/reviewer/assignments/${opts.assignmentId}/request-edit`,
          { instruction: trimmed },
        )
        return true
      } catch (err) {
        const message = ApiClientError.is(err)
          ? err.message
          : 'Gagal mengirim instruksi.'
        MySwal.showValidationMessage(message)
        return false
      }
    },
  })

  if (result.isConfirmed && result.value === true) {
    toast.success('AI sedang memproses revisi', {
      description: 'Anda akan diberi tahu saat revisi siap untuk ditinjau ulang.',
    })
    opts.onSubmitted?.()
    return true
  }
  return false
}
