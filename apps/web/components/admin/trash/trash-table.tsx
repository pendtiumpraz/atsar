// Generic table untuk Sampah (WIREFRAMES §18).
//
// Props: `{ resource: 'figures' | 'battles' }`. Komponen ini:
//
//   - Memuat data via `figuresApi.trash.list` / `battlesApi.trash.list`.
//   - Menampilkan checkbox per baris + checkbox "Pilih semua".
//   - Kolom: Nama (sesuai resource), dihapus (relative), oleh (uuid deletedBy
//     diekspos apa adanya karena join user belum tersedia di endpoint trash).
//   - Per-row actions: ↺ Restore  |  🗑 Hapus Permanen (via `hardDeleteConfirm`).
//   - Bulk actions toolbar (`<TrashToolbar />`) muncul ketika ada seleksi.
//
// Bulk operations dijalankan **sequential** (bukan paralel) supaya:
//   1. Backend tidak terbanting,
//   2. Progress toast bisa diperbarui per item,
//   3. Kegagalan tengah jalan tidak meninggalkan sebagian operasi yang gagal
//      diam-diam — error terakhir dikumpulkan dan ditampilkan.

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ApiClientError } from '@/lib/api/client'
import { battlesApi, figuresApi } from '@/lib/api/endpoints'
import { hardDeleteConfirm } from '@/lib/swal'

import { TrashToolbar } from './trash-toolbar'

export type TrashResource = 'figures' | 'battles'

export interface TrashTableProps {
  resource: TrashResource
}

interface TrashRow {
  id: string
  name: string
  deletedAt: string | null
  deletedBy: string | null
}

interface ApiTrashRow {
  id: string
  // figures
  nameShortId?: string | null
  nameFullId?: string | null
  nameShortAr?: string | null
  nameFullAr?: string | null
  // battles
  nameId?: string | null
  nameAr?: string | null
  // common audit
  deletedAt?: string | Date | null
  deletedBy?: string | null
}

const RESOURCE_LABEL: Record<TrashResource, { singular: string; plural: string }> = {
  figures: { singular: 'tokoh', plural: 'Tokoh' },
  battles: { singular: 'pertempuran', plural: 'Pertempuran' },
}

function pickName(resource: TrashResource, row: ApiTrashRow): string {
  if (resource === 'figures') {
    return (
      row.nameShortId ??
      row.nameFullId ??
      row.nameShortAr ??
      row.nameFullAr ??
      row.id
    )
  }
  return row.nameId ?? row.nameAr ?? row.id
}

function toIsoString(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

const REL_TIME = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' })

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diffMs = then - Date.now()
  const sec = Math.round(diffMs / 1000)
  const abs = Math.abs(sec)
  if (abs < 60) return REL_TIME.format(sec, 'second')
  const min = Math.round(sec / 60)
  if (Math.abs(min) < 60) return REL_TIME.format(min, 'minute')
  const hr = Math.round(min / 60)
  if (Math.abs(hr) < 24) return REL_TIME.format(hr, 'hour')
  const day = Math.round(hr / 24)
  if (Math.abs(day) < 30) return REL_TIME.format(day, 'day')
  const month = Math.round(day / 30)
  if (Math.abs(month) < 12) return REL_TIME.format(month, 'month')
  const year = Math.round(month / 12)
  return REL_TIME.format(year, 'year')
}

function shortenId(id: string | null): string {
  if (!id) return '—'
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function trashApi(resource: TrashResource) {
  return resource === 'figures' ? figuresApi.trash : battlesApi.trash
}

export function TrashTable({ resource }: TrashTableProps) {
  const labels = RESOURCE_LABEL[resource]
  const [rows, setRows] = useState<TrashRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const api = trashApi(resource)
      const data = await api.list({ page: 1, perPage: 100 })
      const apiRows = (data?.rows ?? []) as ApiTrashRow[]
      const normalised: TrashRow[] = apiRows.map((r) => ({
        id: r.id,
        name: pickName(resource, r),
        deletedAt: toIsoString(r.deletedAt ?? null),
        deletedBy: r.deletedBy ?? null,
      }))
      setRows(normalised)
      setSelected((prev) => {
        const next = new Set<string>()
        for (const id of prev) if (normalised.some((r) => r.id === id)) next.add(id)
        return next
      })
    } catch (err) {
      const message = ApiClientError.is(err) ? err.message : 'Gagal memuat data sampah.'
      setError(message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [resource])

  useEffect(() => {
    void load()
  }, [load])

  const allSelected = rows.length > 0 && selected.size === rows.length
  const someSelected = selected.size > 0 && selected.size < rows.length
  const selectAllState = allSelected ? true : someSelected ? 'indeterminate' : false

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === rows.length) return new Set()
      return new Set(rows.map((r) => r.id))
    })
  }, [rows])

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelected(new Set()), [])

  const handleRestore = useCallback(
    async (row: TrashRow) => {
      setBusy(true)
      try {
        await trashApi(resource).restore(row.id)
        toast.success(`"${row.name}" dipulihkan.`)
        await load()
      } catch (err) {
        const message = ApiClientError.is(err) ? err.message : 'Gagal memulihkan item.'
        toast.error(message)
      } finally {
        setBusy(false)
      }
    },
    [resource, load],
  )

  const handleHardDelete = useCallback(
    async (row: TrashRow) => {
      const ok = await hardDeleteConfirm(`${labels.singular} "${row.name}"`)
      if (!ok) return
      setBusy(true)
      try {
        await trashApi(resource).hardDelete(row.id)
        toast.success(`"${row.name}" dihapus permanen.`)
        await load()
      } catch (err) {
        const message = ApiClientError.is(err) ? err.message : 'Gagal menghapus permanen.'
        toast.error(message)
      } finally {
        setBusy(false)
      }
    },
    [resource, labels.singular, load],
  )

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.id)),
    [rows, selected],
  )

  const handleBulkRestore = useCallback(async () => {
    if (selectedRows.length === 0) return
    setBusy(true)
    const total = selectedRows.length
    const toastId = toast.loading(`Memulihkan 0/${total} ${labels.singular}…`)
    const api = trashApi(resource)
    let okCount = 0
    let failCount = 0
    let lastError: string | null = null
    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i]
      if (!row) continue
      try {
        await api.restore(row.id)
        okCount++
      } catch (err) {
        failCount++
        lastError = ApiClientError.is(err) ? err.message : 'Error tidak dikenal'
      }
      toast.loading(`Memulihkan ${i + 1}/${total} ${labels.singular}…`, { id: toastId })
    }
    if (failCount === 0) {
      toast.success(`${okCount} ${labels.singular} dipulihkan.`, { id: toastId })
    } else {
      toast.error(
        `Selesai dengan ${failCount} gagal dari ${total}. ${lastError ?? ''}`.trim(),
        { id: toastId },
      )
    }
    clearSelection()
    await load()
    setBusy(false)
  }, [selectedRows, resource, labels.singular, load, clearSelection])

  const handleBulkHardDelete = useCallback(async () => {
    if (selectedRows.length === 0) return
    const ok = await hardDeleteConfirm(`${selectedRows.length} ${labels.singular} terpilih`)
    if (!ok) return
    setBusy(true)
    const total = selectedRows.length
    const toastId = toast.loading(`Menghapus 0/${total} ${labels.singular}…`)
    const api = trashApi(resource)
    let okCount = 0
    let failCount = 0
    let lastError: string | null = null
    for (let i = 0; i < selectedRows.length; i++) {
      const row = selectedRows[i]
      if (!row) continue
      try {
        await api.hardDelete(row.id)
        okCount++
      } catch (err) {
        failCount++
        lastError = ApiClientError.is(err) ? err.message : 'Error tidak dikenal'
      }
      toast.loading(`Menghapus ${i + 1}/${total} ${labels.singular}…`, { id: toastId })
    }
    if (failCount === 0) {
      toast.success(`${okCount} ${labels.singular} dihapus permanen.`, { id: toastId })
    } else {
      toast.error(
        `Selesai dengan ${failCount} gagal dari ${total}. ${lastError ?? ''}`.trim(),
        { id: toastId },
      )
    }
    clearSelection()
    await load()
    setBusy(false)
  }, [selectedRows, resource, labels.singular, load, clearSelection])

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <Checkbox
                  aria-label="Pilih semua"
                  checked={selectAllState}
                  onCheckedChange={toggleAll}
                  disabled={busy || rows.length === 0}
                />
              </th>
              <th scope="col" className="px-3 py-2">
                Nama {labels.plural}
              </th>
              <th scope="col" className="px-3 py-2">
                Dihapus
              </th>
              <th scope="col" className="px-3 py-2">
                Oleh
              </th>
              <th scope="col" className="w-56 px-3 py-2 text-right">
                Tindakan
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-sm text-[rgb(var(--text-muted))]"
                >
                  Memuat sampah {labels.singular}…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center">
                  <div className="text-sm text-[rgb(var(--danger))]">{error}</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => void load()}
                  >
                    Coba lagi
                  </Button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-[rgb(var(--text-muted))]"
                >
                  Sampah {labels.singular} kosong.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = selected.has(row.id)
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[rgb(var(--border))] last:border-b-0 hover:bg-[rgb(var(--bg-elevated))]/60"
                    data-state={isSelected ? 'selected' : undefined}
                  >
                    <td className="px-3 py-2 align-middle">
                      <Checkbox
                        aria-label={`Pilih ${row.name}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(row.id)}
                        disabled={busy}
                      />
                    </td>
                    <td className="px-3 py-2 align-middle font-medium text-[rgb(var(--text))]">
                      {row.name}
                    </td>
                    <td
                      className="px-3 py-2 align-middle text-[rgb(var(--text-muted))]"
                      title={row.deletedAt ?? undefined}
                    >
                      {formatRelative(row.deletedAt)}
                    </td>
                    <td
                      className="px-3 py-2 align-middle font-mono text-xs text-[rgb(var(--text-muted))]"
                      title={row.deletedBy ?? undefined}
                    >
                      {shortenId(row.deletedBy)}
                    </td>
                    <td className="px-3 py-2 align-middle text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={busy}
                          onClick={() => void handleRestore(row)}
                        >
                          ↺ Restore
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          disabled={busy}
                          onClick={() => void handleHardDelete(row)}
                        >
                          🗑 Hapus Permanen
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <TrashToolbar
        selectedCount={selected.size}
        busy={busy}
        onClearSelection={clearSelection}
        onRestoreSelected={() => void handleBulkRestore()}
        onHardDeleteSelected={() => void handleBulkHardDelete()}
      />
    </div>
  )
}

export default TrashTable
