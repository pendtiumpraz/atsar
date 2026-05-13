// `/admin/trash` — overview Sampah (WIREFRAMES §18).
//
// Server component. Menampilkan ringkasan jumlah item soft-deleted per resource
// (Tokoh / Pertempuran / Lokasi) dengan kartu yang menautkan ke daftar masing-
// masing. Tombol "Kosongkan Semua" hanya menampilkan peringatan visual — eksekusi
// belum diimplementasi (auto-purge cron 30 hari yang sebenarnya membersihkan).
//
// Counts diambil langsung dari DB karena `(admin)/layout.tsx` sudah memverifikasi
// role admin (sehingga aman bypass HTTP hop).

import { isNotNull, sql } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@athar/db'
import { battles, figures, locations } from '@athar/db/schema'

export const metadata: Metadata = {
  title: 'Sampah · Atsar',
  description: 'Daftar konten yang dihapus dan dapat dipulihkan (30 hari).',
}

export const dynamic = 'force-dynamic'

async function countFiguresTrash(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(figures)
    .where(isNotNull(figures.deletedAt))
  return rows[0]?.count ?? 0
}

async function countBattlesTrash(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(battles)
    .where(isNotNull(battles.deletedAt))
  return rows[0]?.count ?? 0
}

async function countLocationsTrash(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(locations)
    .where(isNotNull(locations.deletedAt))
  return rows[0]?.count ?? 0
}

interface TrashCardData {
  href: string
  label: string
  count: number
  description: string
  enabled: boolean
}

export default async function TrashOverviewPage() {
  const [figuresCount, battlesCount, locationsCount] = await Promise.all([
    countFiguresTrash(),
    countBattlesTrash(),
    countLocationsTrash(),
  ])

  const cards: TrashCardData[] = [
    {
      href: '/admin/trash/figures',
      label: 'Tokoh',
      count: figuresCount,
      description: 'Sahabat & ulama yang dihapus.',
      enabled: true,
    },
    {
      href: '/admin/trash/battles',
      label: 'Pertempuran',
      count: battlesCount,
      description: 'Peristiwa & ghazwah yang dihapus.',
      enabled: true,
    },
    {
      href: '#',
      label: 'Lokasi',
      count: locationsCount,
      description: 'Belum tersedia di sampah.',
      enabled: false,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Sampah
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Konten yang dihapus akan disimpan di Sampah dan dapat dipulihkan.
          </p>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled
          title="Belum diimplementasi — auto-purge berjalan otomatis setelah 30 hari."
        >
          Kosongkan Semua
        </Button>
      </header>

      <div
        role="alert"
        className="rounded-md border border-[rgb(var(--warning))]/40 bg-[rgb(var(--warning))]/10 px-4 py-3 text-sm text-[rgb(var(--text))]"
      >
        <strong className="font-semibold">Peringatan:</strong> Item akan dihapus permanen secara
        otomatis jika berada di Sampah lebih dari 30 hari.
      </div>

      <section
        aria-labelledby="trash-buckets-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <h2 id="trash-buckets-heading" className="sr-only">
          Kategori Sampah
        </h2>
        {cards.map((card) => {
          const inner = (
            <Card
              className={
                card.enabled
                  ? 'h-full transition-colors hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]'
                  : 'h-full opacity-60'
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-baseline justify-between gap-2">
                  <span>{card.label}</span>
                  <span className="text-3xl font-semibold tabular-nums text-[rgb(var(--text))]">
                    {new Intl.NumberFormat('id-ID').format(card.count)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[rgb(var(--text-muted))]">{card.description}</p>
              </CardContent>
            </Card>
          )
          if (!card.enabled) {
            return (
              <div key={card.label} aria-disabled="true">
                {inner}
              </div>
            )
          }
          return (
            <Link
              key={card.label}
              href={card.href}
              className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
            >
              {inner}
            </Link>
          )
        })}
      </section>

      <nav aria-label="Tab Sampah" className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/trash/figures">Sampah Tokoh ({figuresCount})</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/trash/battles">Sampah Pertempuran ({battlesCount})</Link>
        </Button>
      </nav>
    </div>
  )
}
