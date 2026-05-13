// SweetAlert2 wrapper themed for Atsar.
//
// The popup styling pulls colour tokens from CSS variables in `globals.css`
// (`--bg-elevated`, `--text`, `--accent`, etc.) by way of the `athar-swal-*`
// class names. Those classes are applied via the `customClass` option so the
// alerts match light and dark themes without re-rendering on mode change.
//
// Public surface:
//   - `MySwal`                — React-bound SweetAlert2 instance (use for
//                               JSX bodies / custom buttons).
//   - `alert(msg, icon?)`     — one-shot informational popup.
//   - `confirm(opts)`         — generic confirm/cancel dialog → boolean.
//   - `deleteConfirm(name)`   — soft-delete confirmation (moves to trash).
//   - `hardDeleteConfirm(name)` — destructive confirm that requires the
//                                 user to type "HAPUS" before proceeding.

'use client'

import Swal, { type SweetAlertIcon, type SweetAlertResult } from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

export const MySwal = withReactContent(Swal)

const ATHAR_CLASSES = {
  popup: 'athar-swal-popup',
  title: 'athar-swal-title',
  htmlContainer: 'athar-swal-html',
  confirmButton: 'athar-swal-confirm',
  cancelButton: 'athar-swal-cancel',
  denyButton: 'athar-swal-deny',
  input: 'athar-swal-input',
  validationMessage: 'athar-swal-validation',
  actions: 'athar-swal-actions',
} as const

/** Confirm dialog options accepted by `confirm()`. */
export interface ConfirmOptions {
  title: string
  text?: string
  /** Defaults to "Lanjutkan". */
  confirmText?: string
  /** Defaults to "Batal". */
  cancelText?: string
  /** Defaults to "question". */
  icon?: SweetAlertIcon
  /** Defaults to false; set true for destructive flows. */
  dangerous?: boolean
}

/**
 * Generic confirm dialog. Resolves to `true` when the user clicks the
 * confirm button, `false` for any other dismissal.
 */
export async function confirm(opts: ConfirmOptions): Promise<boolean> {
  const result: SweetAlertResult = await MySwal.fire({
    title: opts.title,
    text: opts.text,
    icon: opts.icon ?? (opts.dangerous ? 'warning' : 'question'),
    showCancelButton: true,
    confirmButtonText: opts.confirmText ?? 'Lanjutkan',
    cancelButtonText: opts.cancelText ?? 'Batal',
    reverseButtons: true,
    focusCancel: opts.dangerous === true,
    customClass: ATHAR_CLASSES,
    buttonsStyling: false,
  })
  return result.isConfirmed
}

/**
 * Soft-delete confirmation. Sends the resource to trash; user can restore.
 */
export async function deleteConfirm(resourceName: string): Promise<boolean> {
  return confirm({
    title: `Hapus ${resourceName}?`,
    text: `${resourceName} akan dipindahkan ke Sampah dan dapat dipulihkan dalam 30 hari.`,
    confirmText: 'Pindahkan ke Sampah',
    cancelText: 'Batal',
    icon: 'warning',
    dangerous: true,
  })
}

/**
 * Hard-delete confirmation. Requires the user to type `HAPUS` exactly
 * before the confirm button enables. Returns `true` only on confirmed
 * typed phrase.
 */
export async function hardDeleteConfirm(resourceName: string): Promise<boolean> {
  const result: SweetAlertResult<string> = await MySwal.fire({
    title: `Hapus permanen ${resourceName}?`,
    html:
      `<p>Aksi ini <strong>tidak dapat dibatalkan</strong>. ${resourceName} ` +
      `akan dihapus secara permanen dari sistem.</p>` +
      `<p>Ketik <code>HAPUS</code> untuk mengonfirmasi.</p>`,
    icon: 'error',
    input: 'text',
    inputAttributes: {
      autocapitalize: 'characters',
      autocomplete: 'off',
      'aria-label': 'Ketik HAPUS untuk konfirmasi',
    },
    inputValidator: (value) => {
      if (value !== 'HAPUS') return 'Ketik HAPUS (huruf kapital) untuk melanjutkan.'
      return null
    },
    showCancelButton: true,
    confirmButtonText: 'Hapus Permanen',
    cancelButtonText: 'Batal',
    reverseButtons: true,
    focusCancel: true,
    customClass: ATHAR_CLASSES,
    buttonsStyling: false,
  })
  return result.isConfirmed && result.value === 'HAPUS'
}

/**
 * One-shot informational popup. Defaults to the `info` icon so misuse for
 * silent toasts is obvious — for transient feedback prefer `sonner`.
 */
export function alert(
  msg: string,
  icon: SweetAlertIcon = 'info',
  title?: string,
): Promise<SweetAlertResult> {
  return MySwal.fire({
    title: title ?? (icon === 'error' ? 'Terjadi kesalahan' : icon === 'success' ? 'Berhasil' : 'Info'),
    text: msg,
    icon,
    confirmButtonText: 'OK',
    customClass: ATHAR_CLASSES,
    buttonsStyling: false,
  })
}
