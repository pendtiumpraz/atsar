// `/admin/locations/[id]` — edit detail for a single map location.
//
// The id slot doubles as a "new" sentinel so create + edit share one route:
//
//   /admin/locations/new          → blank form, POST on submit
//   /admin/locations/<uuid>       → preloaded form, PUT on submit
//
// We keep this as a Server Component so the `<LocationForm />` client owns
// the data fetching (it already needs TanStack Query for cache invalidation
// across the table view).  No server-side fetch here — saves a round-trip
// and avoids duplicating the locationService output shape.
//
// `<LocationDetailActions />` adds the "Hapus" button + back-link sections
// (figures/battles that reference this location) once we have the row id.

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { LocationForm } from '@/components/admin/locations/location-form'
import { LocationDetailActions } from '@/components/admin/locations/location-detail-actions'

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Edit Lokasi · Admin Atsar',
}

export default async function LocationDetailPage({ params }: PageProps) {
  const { id } = await params
  const isNew = id === 'new'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/locations"
          className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali ke daftar lokasi
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1
              className="text-2xl font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              {isNew ? 'Tambah Lokasi' : 'Edit Lokasi'}
            </h1>
            <p className="text-sm text-[rgb(var(--text-muted))]">
              {isNew
                ? 'Isi metadata lokasi lalu klik peta untuk menentukan titik koordinat.'
                : 'Perbarui metadata atau geser pin di peta untuk memindahkan koordinat.'}
            </p>
          </div>
          {!isNew ? <LocationDetailActions locationId={id} /> : null}
        </div>
      </header>

      <LocationForm locationId={isNew ? null : id} />
    </div>
  )
}
