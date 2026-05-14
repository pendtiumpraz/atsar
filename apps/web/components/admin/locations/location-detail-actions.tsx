// `<LocationDetailActions />` — header-right actions on `/admin/locations/[id]`.
//
// Today this is just the "Hapus" button (soft-delete) — split out so the
// server page stays free of `'use client'` while still surfacing the
// destructive action without forcing the admin to drill into the table.
//
// On confirm: DELETE `/admin/locations/:id`, then toast + redirect.

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { locationsApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'
import { deleteConfirm } from '@/lib/swal'

export interface LocationDetailActionsProps {
  locationId: string
}

export function LocationDetailActions({ locationId }: LocationDetailActionsProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const [busy, setBusy] = React.useState(false)

  async function handleDelete() {
    const ok = await deleteConfirm('lokasi ini')
    if (!ok) return
    setBusy(true)
    try {
      await locationsApi.admin.remove(locationId)
      toast.success('Lokasi dipindahkan ke Sampah')
      void qc.invalidateQueries({ queryKey: ['admin', 'locations', 'all'] })
      router.push('/admin/locations')
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Gagal menghapus lokasi'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={busy}
    >
      <Trash2 className="h-4 w-4" />
      Hapus
    </Button>
  )
}
