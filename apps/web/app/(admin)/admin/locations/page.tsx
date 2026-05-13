// `/admin/locations` — list every Atsar map location with filters.
//
// Server Component shell.  The list itself (TanStack Query + filter UI +
// row-level edit/delete actions) lives in `<LocationsTable />`.  Creating
// a new location pushes the user to `/admin/locations/new`, which falls
// through to the edit detail page since that page handles both create
// and update modes.  We expose a simple "Tambah Lokasi" link so the path
// is discoverable from the index.

import Link from 'next/link'
import { Plus } from 'lucide-react'

import { LocationsTable } from '@/components/admin/locations/locations-table'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Lokasi · Admin Atsar',
}

export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Lokasi
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Kelola titik peta tokoh dan peristiwa. Filter berdasarkan wilayah atau negara.
          </p>
        </div>

        <Button asChild size="sm">
          <Link href="/admin/locations/new">
            <Plus className="h-4 w-4" />
            Tambah Lokasi
          </Link>
        </Button>
      </header>

      <LocationsTable />
    </div>
  )
}
