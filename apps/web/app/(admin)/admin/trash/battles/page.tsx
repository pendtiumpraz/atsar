// `/admin/trash/battles` — Sampah Pertempuran (WIREFRAMES §18).
//
// Server component yang hanya membungkus `<TrashTable resource="battles" />`.

import type { Metadata } from 'next'
import Link from 'next/link'

import { TrashTable } from '@/components/admin/trash/trash-table'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Sampah Pertempuran · Atsar',
  description: 'Daftar pertempuran yang dihapus dan dapat dipulihkan.',
}

export const dynamic = 'force-dynamic'

export default function TrashBattlesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Sampah — Pertempuran
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Pertempuran yang dihapus dan menunggu pemulihan atau penghapusan permanen.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/trash">Kembali ke Sampah</Link>
        </Button>
      </header>

      <TrashTable resource="battles" />
    </div>
  )
}
