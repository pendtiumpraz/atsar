// `/admin/trash/figures` — Sampah Tokoh (WIREFRAMES §18).
//
// Server component yang hanya membungkus `<TrashTable resource="figures" />`.
// Semua interaksi (fetch, pilih, restore, hard delete) ditangani di client.

import type { Metadata } from 'next'
import Link from 'next/link'

import { TrashTable } from '@/components/admin/trash/trash-table'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Sampah Tokoh · Atsar',
  description: 'Daftar tokoh yang dihapus dan dapat dipulihkan.',
}

export const dynamic = 'force-dynamic'

export default function TrashFiguresPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Sampah — Tokoh
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Tokoh yang dihapus dan menunggu pemulihan atau penghapusan permanen.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/trash">Kembali ke Sampah</Link>
        </Button>
      </header>

      <TrashTable resource="figures" />
    </div>
  )
}
