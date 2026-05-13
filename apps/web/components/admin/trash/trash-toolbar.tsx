// Toolbar bulk actions untuk Sampah (WIREFRAMES §18 footer).
//
// Muncul ketika ada baris yang dipilih di `<TrashTable />`. Menyediakan dua
// aksi:
//
//   - "Restore Terpilih"        → bulk POST /trash/:resource/:id/restore
//   - "Hapus Permanen Terpilih" → bulk DELETE /trash/:resource/:id/hard
//
// Komponen ini sengaja dibuat *presentational*: parent (`TrashTable`) yang
// menangani fetch sequential + progress toast karena ia mengontrol seleksi
// dan refresh data setelah operasi.

'use client'

import { Button } from '@/components/ui/button'

export interface TrashToolbarProps {
  /** Jumlah baris yang sedang dipilih. */
  selectedCount: number
  /** Disable semua tombol saat operasi sedang berjalan. */
  busy?: boolean
  onRestoreSelected: () => void
  onHardDeleteSelected: () => void
  onClearSelection?: () => void
}

export function TrashToolbar({
  selectedCount,
  busy = false,
  onRestoreSelected,
  onHardDeleteSelected,
  onClearSelection,
}: TrashToolbarProps) {
  if (selectedCount <= 0) return null

  return (
    <div
      role="toolbar"
      aria-label="Aksi massal sampah"
      className="sticky bottom-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]/95 px-4 py-3 shadow-md backdrop-blur"
    >
      <div className="text-sm text-[rgb(var(--text))]">
        <span className="font-semibold tabular-nums">{selectedCount}</span> item dipilih
      </div>
      <div className="flex flex-wrap gap-2">
        {onClearSelection ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={onClearSelection}
          >
            Batal pilih
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onRestoreSelected}
        >
          Restore Terpilih
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={onHardDeleteSelected}
        >
          Hapus Permanen Terpilih
        </Button>
      </div>
    </div>
  )
}

export default TrashToolbar
