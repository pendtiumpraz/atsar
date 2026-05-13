// Right-pane detail view for a single figure (WIREFRAMES §6 + §7).
//
// - 'use client' for shadcn `<Tabs />` (uses Radix state hooks).
// - Hydrates from the server-fetched `initialData` to avoid a flash of
//   loading state, then refetches in the background via TanStack Query so
//   future invalidations (after edit) propagate without a hard reload.
//
// Tab content for everything beyond Biografi is a stub for now — full
// implementations land in F12 (Timeline), F13 (Peta), F14 (Hubungan),
// F15 (Hadits), F16 (Sumber).  We render a small placeholder so users see
// the expected structure during Phase 4.

'use client'

import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { figuresApi } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

// Same loose shape as the card — only the fields we render are typed.  The
// service also returns `relations` + `locations`; we surface them where
// applicable but tolerate `undefined`.
export interface FigureDetailData {
  id: string
  slug: string
  gender?: 'male' | 'female' | null
  nameFullAr?: string | null
  nameFullId?: string | null
  nameShortAr?: string | null
  nameShortId?: string | null
  kunyahAr?: string | null
  kunyahId?: string | null
  laqabAr?: string | null
  laqabId?: string | null
  birthDateAh?: number | null
  birthDateCe?: number | null
  deathDateAh?: number | null
  deathDateCe?: number | null
  rijalGrade?: string | null
  socialCategory?: string[] | null
  summaryAr?: string | null
  summaryId?: string | null
  biographyAr?: string | null
  biographyId?: string | null
  hadithCountMin?: number | null
  hadithCountMax?: number | null
  category?: { slug?: string; nameId?: string | null; nameAr?: string | null } | null
  locations?: unknown[]
  relations?: unknown[]
}

export interface FigureDetailProps {
  slug: string
  /** Optional SSR-fetched data to hydrate from. */
  initialData?: FigureDetailData
}

export function FigureDetail({ slug, initialData }: FigureDetailProps) {
  const { data, isPending, isError, error } = useQuery<FigureDetailData>({
    queryKey: ['figure', slug],
    queryFn: () => figuresApi.getBySlug(slug) as Promise<FigureDetailData>,
    initialData,
    staleTime: 60_000,
  })

  if (isPending) {
    return <FigureDetailSkeleton />
  }

  if (isError || !data) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-4 text-sm text-[rgb(var(--danger))]"
      >
        Gagal memuat detail tokoh.
        {error instanceof Error ? <div className="mt-1 opacity-80">{error.message}</div> : null}
      </div>
    )
  }

  const latinName = data.nameFullId || data.nameShortId || data.slug
  const arabicName = data.nameFullAr || data.nameShortAr
  const categoryLabel = data.category?.nameId || data.category?.slug

  return (
    <article className="flex flex-col gap-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-6">
      {/* Header */}
      <header className="flex flex-col gap-2">
        {arabicName ? (
          <h1
            lang="ar"
            dir="rtl"
            className="text-3xl font-semibold leading-tight text-[rgb(var(--text))] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display-arab)' }}
          >
            {arabicName}
          </h1>
        ) : null}
        <div className="text-lg font-medium text-[rgb(var(--text-muted))]">
          {latinName}
          {data.gender === 'female' ? ' (RA)' : data.gender === 'male' ? ' (RA)' : ''}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
          {categoryLabel ? <Badge variant="secondary">{categoryLabel}</Badge> : null}
          {data.kunyahAr || data.kunyahId ? (
            <span>
              Kunyah:{' '}
              <span className="font-medium text-[rgb(var(--text))]">
                {data.kunyahId || data.kunyahAr}
              </span>
            </span>
          ) : null}
          {typeof data.birthDateAh === 'number' || typeof data.birthDateCe === 'number' ? (
            <span>
              Lahir:{' '}
              <span className="font-medium text-[rgb(var(--text))]">
                {formatYear(data.birthDateAh, data.birthDateCe)}
              </span>
            </span>
          ) : null}
          {typeof data.deathDateAh === 'number' || typeof data.deathDateCe === 'number' ? (
            <span>
              Wafat:{' '}
              <span className="font-medium text-[rgb(var(--text))]">
                {formatYear(data.deathDateAh, data.deathDateCe)}
              </span>
            </span>
          ) : null}
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="biografi" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="biografi">Biografi</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="peta">Peta</TabsTrigger>
          <TabsTrigger value="hubungan">Hubungan</TabsTrigger>
          <TabsTrigger value="hadits">Hadits</TabsTrigger>
          <TabsTrigger value="sumber">Sumber</TabsTrigger>
        </TabsList>

        <TabsContent value="biografi" className="mt-4">
          <BiographyTab data={data} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TabPlaceholder
            title="Timeline"
            body="Sumbu hidup tokoh dengan peristiwa penting akan tampil di sini."
          />
        </TabsContent>

        <TabsContent value="peta" className="mt-4">
          <TabPlaceholder
            title="Peta"
            body={
              data.locations && data.locations.length > 0
                ? `${data.locations.length} lokasi tercatat. Peta akan dirender di tab ini.`
                : 'Belum ada data lokasi untuk tokoh ini.'
            }
          />
        </TabsContent>

        <TabsContent value="hubungan" className="mt-4">
          <TabPlaceholder
            title="Hubungan"
            body={
              data.relations && data.relations.length > 0
                ? `${data.relations.length} relasi tercatat (guru/murid/keluarga). Graph network akan dirender di sini.`
                : 'Belum ada data hubungan untuk tokoh ini.'
            }
          />
        </TabsContent>

        <TabsContent value="hadits" className="mt-4">
          <HadithTab data={data} />
        </TabsContent>

        <TabsContent value="sumber" className="mt-4">
          <TabPlaceholder
            title="Sumber"
            body="Daftar citation untuk tokoh ini akan tampil di sini. Klik citation membuka modal side-by-side dengan sumber asli."
          />
        </TabsContent>
      </Tabs>
    </article>
  )
}

function BiographyTab({ data }: { data: FigureDetailData }) {
  const summary = data.summaryId || data.summaryAr
  const biography = data.biographyId || data.biographyAr

  if (!summary && !biography) {
    return (
      <TabPlaceholder
        title="Biografi"
        body="Biografi tokoh ini sedang dipersiapkan oleh tim reviewer."
      />
    )
  }

  return (
    <div className="prose-athar flex max-w-none flex-col gap-4 text-sm leading-relaxed text-[rgb(var(--text))]">
      {summary ? (
        <p className="text-base italic text-[rgb(var(--text-muted))]">{summary}</p>
      ) : null}
      {biography ? (
        // No markdown renderer yet (lands with F11+) — show as preformatted
        // text so paragraph breaks survive.  Replace with `react-markdown`
        // when available.
        <div className="whitespace-pre-wrap">{biography}</div>
      ) : null}

      <CitationStub />
    </div>
  )
}

function HadithTab({ data }: { data: FigureDetailData }) {
  const { hadithCountMin, hadithCountMax } = data
  if (typeof hadithCountMin !== 'number' && typeof hadithCountMax !== 'number') {
    return (
      <TabPlaceholder
        title="Hadits"
        body="Belum ada data jumlah hadits untuk tokoh ini."
      />
    )
  }
  const range =
    typeof hadithCountMin === 'number' && typeof hadithCountMax === 'number'
      ? `${hadithCountMin.toLocaleString('id-ID')} – ${hadithCountMax.toLocaleString('id-ID')}`
      : (hadithCountMin ?? hadithCountMax)?.toLocaleString('id-ID')

  return (
    <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4 text-sm text-[rgb(var(--text))]">
      Diriwayatkan sekitar <span className="font-semibold">{range}</span> hadits.{' '}
      <span className="text-[rgb(var(--text-muted))]">
        Tautan ke koleksi hadits akan ditambahkan kemudian.
      </span>
    </div>
  )
}

function TabPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
      <p className="mt-2 text-xs text-[rgb(var(--text-faint))]">Coming soon.</p>
    </div>
  )
}

function CitationStub() {
  return (
    <div className="mt-2 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-xs text-[rgb(var(--text-faint))]">
      Daftar citation akan dirender di sini setelah modul Sumber tersedia.
    </div>
  )
}

function FigureDetailSkeleton() {
  return (
    <div
      aria-hidden
      className={cn(
        'flex animate-pulse flex-col gap-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6',
      )}
    >
      <div className="h-8 w-2/3 rounded bg-[rgb(var(--bg-elevated))]" />
      <div className="h-4 w-1/3 rounded bg-[rgb(var(--bg-elevated))]" />
      <div className="mt-3 h-10 w-full rounded bg-[rgb(var(--bg-elevated))]" />
      <div className="mt-2 h-24 w-full rounded bg-[rgb(var(--bg-elevated))]" />
    </div>
  )
}

function formatYear(ah: number | null | undefined, ce: number | null | undefined): string {
  const parts: string[] = []
  if (typeof ah === 'number') parts.push(`${ah} H`)
  if (typeof ce === 'number') parts.push(`${ce} M`)
  return parts.join(' / ') || '—'
}
