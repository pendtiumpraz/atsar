// `<LocationForm />` — create / edit form for a map location.
//
// Twin role:
//   - `locationId === null` → blank form, submit creates a new row (POST).
//   - `locationId === <uuid>` → preload from the public list and PUT on save.
//
// The form mirrors the backend Zod schemas in `app/api/v1/admin/locations/*`.
// `lat` / `lng` are kept in sync with `<LocationMapPicker />`: typing into
// the numeric inputs moves the marker, dragging / clicking the map fills the
// inputs.  React Hook Form is the single source of truth; the picker is a
// dumb controlled component.
//
// We deliberately skip a public GET-by-id endpoint (none exists yet) and
// instead pull the row out of the public list cache.  That keeps this
// component aligned with `<LocationsTable />` and reuses the same
// `['admin', 'locations', 'all']` TanStack key.

'use client'

import { useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'

// MapLibre touches `window` at module load — keep it client-only.
const LocationMapPicker = dynamic(
  () =>
    import('@/components/admin/locations/location-map-picker').then(
      (m) => m.LocationMapPicker,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-sm text-[rgb(var(--text-muted))]">
        Memuat peta…
      </div>
    ),
  },
)

interface LocationRow {
  id: string
  slug: string
  nameAr: string
  nameId: string
  modernName: string | null
  countryCode: string | null
  region: string | null
  elevationMeters: number | null
  historicalPeriod: string[] | null
  descriptionAr: string | null
  descriptionId: string | null
  coordinates: { type: 'Point'; coordinates: [number, number] } | null
}

const formSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug wajib diisi')
    .max(160, 'Slug terlalu panjang')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug harus kebab-case (huruf kecil + tanda hubung)'),
  nameAr: z.string().min(1, 'Nama Arab wajib diisi').max(200),
  nameId: z.string().min(1, 'Nama Indonesia wajib diisi').max(200),
  modernName: z.string().max(200).optional(),
  countryCode: z
    .string()
    .trim()
    .max(3)
    .regex(/^[A-Za-z]{2,3}$/, 'Kode negara 2–3 huruf (mis. SAU, ID)')
    .optional()
    .or(z.literal('')),
  region: z.string().trim().max(64).optional(),
  // `elevationMeters` arrives as a string from the input and is coerced to
  // number | null at submit. Empty string is kept as a sentinel for "unset".
  elevationMeters: z.string().trim().max(10).optional(),
  // Comma-separated list of historical-period tags, e.g. "khulafa, umayyah".
  historicalPeriod: z.string().trim().max(500).optional(),
  descriptionAr: z.string().max(8000).optional(),
  descriptionId: z.string().max(8000).optional(),
  lat: z.coerce.number().min(-90, 'Lat harus -90..90').max(90, 'Lat harus -90..90'),
  lng: z.coerce
    .number()
    .min(-180, 'Lng harus -180..180')
    .max(180, 'Lng harus -180..180'),
})

type FormValues = z.input<typeof formSchema>

const EMPTY_DEFAULTS: FormValues = {
  slug: '',
  nameAr: '',
  nameId: '',
  modernName: '',
  countryCode: '',
  region: '',
  elevationMeters: '',
  historicalPeriod: '',
  descriptionAr: '',
  descriptionId: '',
  // Default to Mekkah — same anchor as the public map.
  lat: 21.4225,
  lng: 39.8262,
}

const LIST_KEY = ['admin', 'locations', 'all'] as const

async function listLocations(): Promise<LocationRow[]> {
  const res = await api.get<LocationRow[] | { rows?: LocationRow[] }>('/locations')
  if (Array.isArray(res)) return res
  return res?.rows ?? []
}

export interface LocationFormProps {
  /** `null` means "create new", otherwise the location uuid. */
  locationId: string | null
}

export function LocationForm({ locationId }: LocationFormProps) {
  const router = useRouter()
  const qc = useQueryClient()
  const isEdit = locationId != null

  // Reuse the public-list cache — `<LocationsTable />` populates it on the
  // index page so navigating to edit is usually a cache hit.
  const listQuery = useQuery({
    queryKey: LIST_KEY,
    queryFn: listLocations,
    enabled: isEdit,
  })

  const initial = useMemo<FormValues | null>(() => {
    if (!isEdit) return EMPTY_DEFAULTS
    const row = listQuery.data?.find((r) => r.id === locationId)
    if (!row) return null
    const coords = row.coordinates?.coordinates
    return {
      slug: row.slug,
      nameAr: row.nameAr,
      nameId: row.nameId,
      modernName: row.modernName ?? '',
      countryCode: row.countryCode ?? '',
      region: row.region ?? '',
      elevationMeters:
        typeof row.elevationMeters === 'number' ? String(row.elevationMeters) : '',
      historicalPeriod: Array.isArray(row.historicalPeriod)
        ? row.historicalPeriod.join(', ')
        : '',
      descriptionAr: row.descriptionAr ?? '',
      descriptionId: row.descriptionId ?? '',
      lat: coords ? coords[1] : EMPTY_DEFAULTS.lat,
      lng: coords ? coords[0] : EMPTY_DEFAULTS.lng,
    }
  }, [isEdit, locationId, listQuery.data])

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_DEFAULTS,
  })

  // Reset the form once the location row arrives from the cache / network.
  useEffect(() => {
    if (initial) reset(initial)
  }, [initial, reset])

  const lat = watch('lat')
  const lng = watch('lng')

  async function onSubmit(values: FormValues) {
    const parsed = formSchema.safeParse(values)
    if (!parsed.success) return
    const data = parsed.data

    // Normalise elevation: "" → null, otherwise parseInt (server route
    // also coerces, but normalising here gives a cleaner audit diff).
    let elevation: number | null = null
    if (data.elevationMeters && data.elevationMeters.trim().length > 0) {
      const parsed = Number(data.elevationMeters)
      elevation = Number.isFinite(parsed) ? Math.trunc(parsed) : null
    }

    // Comma-separated tags → string[]. Empty → null.
    const historicalPeriod: string[] | null = data.historicalPeriod
      ? data.historicalPeriod
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : null

    const body = {
      slug: data.slug,
      nameAr: data.nameAr,
      nameId: data.nameId,
      modernName: data.modernName ? data.modernName : null,
      countryCode: data.countryCode ? data.countryCode.toUpperCase() : null,
      region: data.region ? data.region : null,
      elevationMeters: elevation,
      historicalPeriod: historicalPeriod && historicalPeriod.length > 0 ? historicalPeriod : null,
      descriptionAr: data.descriptionAr ? data.descriptionAr : null,
      descriptionId: data.descriptionId ? data.descriptionId : null,
      lat: data.lat,
      lng: data.lng,
    }

    try {
      if (isEdit && locationId) {
        await api.put(`/admin/locations/${locationId}`, body)
        toast.success('Lokasi diperbarui')
      } else {
        await api.post('/admin/locations', body)
        toast.success('Lokasi ditambahkan')
      }
      void qc.invalidateQueries({ queryKey: LIST_KEY })
      router.push('/admin/locations')
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in EMPTY_DEFAULTS) {
            setError(field as keyof FormValues, { message })
          }
        }
        toast.error(err.message)
        return
      }
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan lokasi'
      toast.error(msg)
    }
  }

  // Spinner while we're still fetching the row to preload the form.
  if (isEdit && (listQuery.isPending || (listQuery.isSuccess && !initial))) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-sm text-[rgb(var(--text-muted))]">
        {listQuery.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat data lokasi…
          </>
        ) : (
          <>Lokasi tidak ditemukan.</>
        )}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      {/* ── Metadata column ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            placeholder="mekkah-al-mukarromah"
            aria-invalid={errors.slug ? 'true' : 'false'}
            {...register('slug')}
          />
          {errors.slug && (
            <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
              {errors.slug.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nameId">Nama (Indonesia)</Label>
            <Input
              id="nameId"
              aria-invalid={errors.nameId ? 'true' : 'false'}
              {...register('nameId')}
            />
            {errors.nameId && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.nameId.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nameAr">Nama (Arab)</Label>
            <Input
              id="nameAr"
              dir="rtl"
              style={{ fontFamily: 'var(--font-display-arabic)' }}
              aria-invalid={errors.nameAr ? 'true' : 'false'}
              {...register('nameAr')}
            />
            {errors.nameAr && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.nameAr.message}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="modernName">Nama modern</Label>
          <Input
            id="modernName"
            placeholder="Mekkah, Arab Saudi"
            {...register('modernName')}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="countryCode">Kode negara</Label>
            <Input
              id="countryCode"
              placeholder="SAU"
              maxLength={3}
              aria-invalid={errors.countryCode ? 'true' : 'false'}
              {...register('countryCode')}
            />
            {errors.countryCode && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.countryCode.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Wilayah</Label>
            <Input id="region" placeholder="Hijaz" {...register('region')} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="elevationMeters">Elevasi (meter)</Label>
            <Input
              id="elevationMeters"
              type="number"
              inputMode="numeric"
              placeholder="mis. 277"
              aria-invalid={errors.elevationMeters ? 'true' : 'false'}
              {...register('elevationMeters')}
            />
            {errors.elevationMeters && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.elevationMeters.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="historicalPeriod">Periode Historis</Label>
            <Input
              id="historicalPeriod"
              placeholder="mis. khulafa, umayyah, abbasiyah"
              {...register('historicalPeriod')}
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Pisahkan dengan koma. Kosongkan jika tidak relevan.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="descriptionId">Deskripsi (Indonesia)</Label>
          <Textarea id="descriptionId" rows={4} {...register('descriptionId')} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="descriptionAr">Deskripsi (Arab)</Label>
          <Textarea
            id="descriptionAr"
            rows={4}
            dir="rtl"
            style={{ fontFamily: 'var(--font-display-arabic)' }}
            {...register('descriptionAr')}
          />
        </div>
      </div>

      {/* ── Map + coords column ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="lat">Lintang (lat)</Label>
            <Controller
              control={control}
              name="lat"
              render={({ field }) => (
                <Input
                  id="lat"
                  type="number"
                  step="0.000001"
                  inputMode="decimal"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-invalid={errors.lat ? 'true' : 'false'}
                />
              )}
            />
            {errors.lat && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.lat.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng">Bujur (lng)</Label>
            <Controller
              control={control}
              name="lng"
              render={({ field }) => (
                <Input
                  id="lng"
                  type="number"
                  step="0.000001"
                  inputMode="decimal"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  aria-invalid={errors.lng ? 'true' : 'false'}
                />
              )}
            />
            {errors.lng && (
              <p className="text-xs" style={{ color: 'rgb(var(--danger))' }}>
                {errors.lng.message}
              </p>
            )}
          </div>
        </div>

        <div className="h-80 overflow-hidden rounded-md border border-[rgb(var(--border))]">
          <LocationMapPicker
            lat={Number(lat)}
            lng={Number(lng)}
            onChange={(next) => {
              setValue('lat', next.lat, { shouldDirty: true, shouldValidate: false })
              setValue('lng', next.lng, { shouldDirty: true, shouldValidate: false })
            }}
          />
        </div>
        <p className="text-xs text-[rgb(var(--text-muted))]">
          Klik di peta atau geser pin untuk menyesuaikan koordinat. Nilai akan
          terupdate otomatis pada kolom Lintang / Bujur.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/admin/locations')}
            disabled={isSubmitting}
          >
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Simpan Perubahan' : 'Buat Lokasi'}
          </Button>
        </div>
      </div>
    </form>
  )
}
