// Right-pane detail view for a single figure (WIREFRAMES §6 + §7).
//
// 'use client' so we can drive the tabs (Radix state) and the various
// per-tab interactions (language toggle on Biografi, MapLibre on Peta).
// Hydrates from `initialData` (server-fetched) and refetches in the
// background via TanStack Query so post-edit invalidations propagate
// without a hard reload.
//
// All six tabs render real data sourced from the enriched `getBySlug`
// payload (see `figureService.getBySlug`). Each tab has a meaningful
// empty state — never the words "Coming Soon".
//
// The header has been promoted into `<FigureHero />` which carries the
// arabesque background, big bilingual name, honorific/category chips,
// quick-stat grid, reading-time, share link, and admin "Perbarui via
// AI" CTA. This component now just hosts the hero + tabs.

'use client'

import { useQuery } from '@tanstack/react-query'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { figuresApi } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

import { FigureHero } from './figure-hero'
import { FigureBiografiTab } from './tabs/figure-biografi-tab'
import { FigureTimelineTab } from './tabs/figure-timeline-tab'
import { FigurePetaTab } from './tabs/figure-peta-tab'
import { FigureHubunganTab } from './tabs/figure-hubungan-tab'
import { FigureHaditsTab } from './tabs/figure-hadits-tab'
import { FigureSumberTab } from './tabs/figure-sumber-tab'

// ─── Shared types ──────────────────────────────────────────────────────
// Re-export so each tab subcomponent has a single source of truth and the
// outer page doesn't have to import from `figure-detail.tsx` to type the
// initialData hydrator.

export interface FigureLocationEntry {
  id: string
  role:
    | 'birthplace'
    | 'residence'
    | 'dakwah'
    | 'martyr'
    | 'burial'
  periodStartAh: number | null
  periodEndAh: number | null
  notesAr: string | null
  notesId: string | null
  location: {
    id: string
    slug: string
    nameId: string
    nameAr: string
    modernName: string | null
    countryCode: string | null
    region: string | null
    coordinates: { type: 'Point'; coordinates: [number, number] } | null
  }
}

export interface FigureRelationEntry {
  id: string
  relationType:
    | 'teacher_of'
    | 'student_of'
    | 'father'
    | 'mother'
    | 'husband'
    | 'wife'
    | 'son'
    | 'daughter'
    | 'sibling'
    | 'companion'
    | 'descendant'
    | 'ancestor'
  notesAr: string | null
  notesId: string | null
  related: {
    id: string
    slug: string
    gender: 'male' | 'female'
    nameFullId: string
    nameFullAr: string
    nameShortId: string | null
    nameShortAr: string | null
  }
}

export interface FigureTimelineBattleEntry {
  battleId: string
  slug: string
  nameId: string
  nameAr: string
  eventDateAh: number | null
  eventDateCe: number | null
  role: 'commander' | 'sahabat' | 'fallen' | 'captured'
}

export interface FigureTimelinePayload {
  birthAh: number | null
  birthCe: number | null
  deathAh: number | null
  deathCe: number | null
  battles: FigureTimelineBattleEntry[]
}

export interface FigureCitationEntry {
  id: string
  sourceUrl: string
  sourceDomain: string | null
  sourceLang: 'ar' | 'id' | 'en' | null
  sourceExcerptAr: string | null
  sourceExcerptId: string | null
  fieldPath: string | null
  confidenceScore: string | null
  createdAt: string | Date
  extractedAt: string | Date | null
  domain: { displayName: string | null; priority: number | null } | null
}

// Same loose shape as the card — only the fields we render are typed.
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
  biographyPreWafatAr?: string | null
  biographyPreWafatId?: string | null
  biographyPostWafatAr?: string | null
  biographyPostWafatId?: string | null
  hadithCountMin?: number | null
  hadithCountMax?: number | null
  category?: { slug?: string; nameId?: string | null; nameAr?: string | null } | null
  locations?: FigureLocationEntry[]
  relations?: FigureRelationEntry[]
  timelineEvents?: FigureTimelinePayload
  citations?: FigureCitationEntry[]
}

export interface FigureDetailProps {
  slug: string
  /** Optional SSR-fetched data to hydrate from. */
  initialData?: FigureDetailData
  /** Whether the viewer is an admin — drives the hero/sumber CTAs. */
  isAdmin?: boolean
}

export function FigureDetail({ slug, initialData, isAdmin = false }: FigureDetailProps) {
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

  return (
    <article className="flex flex-col gap-4">
      <FigureHero data={data} isAdmin={isAdmin} />

      {/* Tabs */}
      <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-6">
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
            <FigureBiografiTab data={data} isAdmin={isAdmin} />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <FigureTimelineTab data={data} />
          </TabsContent>

          <TabsContent value="peta" className="mt-4">
            <FigurePetaTab data={data} />
          </TabsContent>

          <TabsContent value="hubungan" className="mt-4">
            <FigureHubunganTab data={data} />
          </TabsContent>

          <TabsContent value="hadits" className="mt-4">
            <FigureHaditsTab data={data} />
          </TabsContent>

          <TabsContent value="sumber" className="mt-4">
            <FigureSumberTab data={data} isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>
    </article>
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
