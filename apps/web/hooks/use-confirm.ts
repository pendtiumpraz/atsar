// `useConfirm` — tiny adapter around the SweetAlert2 wrapper in `lib/swal`.
//
// Exists so call sites can `const { confirm, deleteConfirm } = useConfirm()`
// (idiomatic React hook surface) instead of importing the raw functions. If
// we later switch to a React-Context driven modal system this is the single
// integration point to update.

'use client'

import { useMemo } from 'react'

import {
  alert as athAlert,
  confirm as athConfirm,
  deleteConfirm as athDeleteConfirm,
  hardDeleteConfirm as athHardDeleteConfirm,
} from '@/lib/swal'

export interface UseConfirmReturn {
  confirm: typeof athConfirm
  deleteConfirm: typeof athDeleteConfirm
  hardDeleteConfirm: typeof athHardDeleteConfirm
  alert: typeof athAlert
}

export function useConfirm(): UseConfirmReturn {
  // Functions are module-scoped and stable — memoising the returned object
  // keeps reference equality across renders so callers can include it in
  // `useEffect` deps without re-firing.
  return useMemo(
    () => ({
      confirm: athConfirm,
      deleteConfirm: athDeleteConfirm,
      hardDeleteConfirm: athHardDeleteConfirm,
      alert: athAlert,
    }),
    [],
  )
}
