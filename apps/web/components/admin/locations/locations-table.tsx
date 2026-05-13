// `<LocationsTable />` — admin CRUD list for map locations.
//
// Pulls the public locations list (which is what the map page uses too) and
// adds region + country filters.  No pagination — the dataset is bounded
// (~30 rows today, low hundreds long-term) and filtering is client-side so
// the UI stays snappy without an extra round-trip per keystroke.
//
// Each row renders a compact coordinate readout and links to the detail
// page (`/admin/locations/[id]`) for editing.  Delete uses the SweetAlert2
// soft-delete confirm helper.

'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Loader2, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, ApiClientError } from '@/lib/api/client'
import { deleteConfirm } from '@/lib/swal'

interface LocationRow {
  id: string
  slug: string
  nameAr: string
  nameId: string
  modernName: string | null
  countryCode: string | null
  region: string | null
  coordinates: { type: 'Point'; coordinates: [number, number] } | null
}

const QUERY_KEY = ['admin', 'locations', 'all'] as const

async function listLocations(): Promise<LocationRow[]> {
  // Public list is the source of truth — admins see the same rows everyone
  // else does (admin-only mutations go through `/admin/locations/[id]`).
  const res = await api.get<LocationRow[] | { rows?: LocationRow[] }>('/locations')
  if (Array.isArray(res)) return res
  return res?.rows ?? []
}

const ALL = '__all__'

export function LocationsTable() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [region, setRegion] = useState<string>(ALL)
  const [country, setCountry] = useState<string>(ALL)

  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listLocations })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/admin/locations/${id}`),
    onSuccess: () => {
      toast.success('Lokasi dipindahkan ke Sampah')
      void qc.invalidateQueries({ queryKey: QUERY_KEY })
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menghapus lokasi'
      toast.error(msg)
    },
  })

  const rows = query.data ?? []

  const { regions, countries } = useMemo(() => {
    const r = new Set<string>()
    const c = new Set<string>()
    for (const row of rows) {
      if (row.region) r.add(row.region)
      if (row.countryCode) c.add(row.countryCode)
    }
    return {
      regions: Array.from(r).sort(),
      countries: Array.from(c).sort(),
    }
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((row) => {
      if (region !== ALL && row.region !== region) return false
      if (country !== ALL && row.countryCode !== country) return false
      if (needle.length > 0) {
        const hay =
          `${row.nameId} ${row.nameAr} ${row.modernName ?? ''} ${row.slug}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [rows, q, region, country])

  async function handleDelete(row: LocationRow) {
    const ok = await deleteConfirm(`lokasi ${row.nameId}`)
    if (!ok) return
    deleteMutation.mutate(row.id)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Cari nama atau slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="Wilayah" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua wilayah</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Negara" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Semua negara</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          {query.isPending
            ? 'Memuat…'
            : query.isError
              ? 'Gagal memuat lokasi.'
              : `${filtered.length} / ${rows.length} lokasi`}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase text-[rgb(var(--text-muted))]">
            <tr>
              <th className="px-3 py-2 font-medium">Nama</th>
              <th className="px-3 py-2 font-medium">Nama Modern</th>
              <th className="px-3 py-2 font-medium">Wilayah</th>
              <th className="px-3 py-2 font-medium">Negara</th>
              <th className="px-3 py-2 font-medium">Koordinat</th>
              <th className="px-3 py-2 font-medium text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {query.isPending ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[rgb(var(--text-muted))]">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-[rgb(var(--text-muted))]">
                  Tidak ada lokasi cocok.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const coords = row.coordinates?.coordinates
                return (
                  <tr
                    key={row.id}
                    className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]/40"
                  >
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <Link
                          href={`/admin/locations/${row.id}`}
                          className="font-medium text-[rgb(var(--text))] hover:underline"
                        >
                          {row.nameId}
                        </Link>
                        <span
                          className="text-xs text-[rgb(var(--text-muted))]"
                          dir="rtl"
                          style={{ fontFamily: 'var(--font-display-arabic)' }}
                        >
                          {row.nameAr}
                        </span>
                        <span className="text-xs font-mono text-[rgb(var(--text-muted))]">
                          {row.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[rgb(var(--text))]">
                      {row.modernName ?? (
                        <span className="text-[rgb(var(--text-muted))]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.region ? (
                        <Badge variant="secondary">{row.region}</Badge>
                      ) : (
                        <span className="text-[rgb(var(--text-muted))]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.countryCode ? (
                        <Badge variant="outline">{row.countryCode}</Badge>
                      ) : (
                        <span className="text-[rgb(var(--text-muted))]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {coords ? (
                        <span className="font-mono text-xs tabular-nums text-[rgb(var(--text-muted))]">
                          {coords[1].toFixed(4)}, {coords[0].toFixed(4)}
                        </span>
                      ) : (
                        <span className="text-[rgb(var(--text-muted))]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="xs" aria-label="Edit">
                          <Link href={`/admin/locations/${row.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => handleDelete(row)}
                          disabled={
                            deleteMutation.isPending && deleteMutation.variables === row.id
                          }
                          aria-label="Hapus"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  )
}
