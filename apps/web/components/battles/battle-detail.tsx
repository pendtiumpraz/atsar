// Battle detail tabs container (WIREFRAMES §13).
//
// 'use client' for shadcn `<Tabs />` (Radix state hooks).  All data comes in
// via props from the server component — the client does NOT refetch the
// battle itself; only the map (interactive) and participant list have local
// state.
//
// Tabs:
//   - Narasi          : markdown narrative_id (id preferred, falls back to ar)
//   - Peta Strategi   : <BattleMap /> with phase slider
//   - Tokoh           : <ParticipantList />
//   - Fase            : ordered list of phases + descriptions
//   - Sumber          : citations placeholder (full module lands later)

'use client'

import * as React from 'react'
import { Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'

import { BattleMap, type BattleMapPhase } from '@/components/battles/battle-map'
import { BattleReingestDialog } from '@/components/battles/battle-reingest-dialog'
import { ParticipantList, type ParticipantListItem } from '@/components/battles/participant-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import type { BattleReingestCurrentSnapshot } from '@/components/admin/battles/battle-reingest-panel'

export interface BattleDetailData {
  id: string
  slug: string
  nameAr?: string | null
  nameId?: string | null
  type?: 'ghazwah' | 'sariyyah' | 'futuhat' | null
  eventDateAh?: number | null
  eventDateCe?: number | null
  outcome?: 'victory' | 'defeat' | 'truce' | 'partial' | null
  muslimCount?: number | null
  opponentCount?: number | null
  opponentForce?: string | null
  casualtiesMuslim?: number | null
  casualtiesOpponent?: number | null
  strategyAr?: string | null
  strategyId?: string | null
  narrativeAr?: string | null
  narrativeId?: string | null
  significanceAr?: string | null
  significanceId?: string | null
  latitude?: number | null
  longitude?: number | null
  location?: { id?: string; nameId?: string | null; nameAr?: string | null; latitude?: number | null; longitude?: number | null } | null
}

export interface BattleDetailProps {
  battle: BattleDetailData
  phases?: BattleMapPhase[]
  participants?: ParticipantListItem[]
  citations?: BattleCitation[]
  className?: string
  /** Admin flag — when true, the Sumber tab renders a refresh button and the
   *  "Data direfresh terakhir" status line. */
  isAdmin?: boolean
  /** Snapshot of the battle row used as the "Sekarang" column of the diff
   *  dialog when an admin clicks "Perbarui sekarang" from the Sumber tab. */
  reingestSnapshot?: BattleReingestCurrentSnapshot
}

export interface BattleCitation {
  id?: string
  title?: string | null
  author?: string | null
  url?: string | null
  excerpt?: string | null
}

export function BattleDetail({
  battle,
  phases = [],
  participants = [],
  citations = [],
  className,
  isAdmin = false,
  reingestSnapshot,
}: BattleDetailProps) {
  // Coordinates: prefer battle.latitude/longitude, then nested location row.
  const latitude = battle.latitude ?? battle.location?.latitude ?? null
  const longitude = battle.longitude ?? battle.location?.longitude ?? null
  const displayName = battle.nameId || battle.slug

  return (
    <Tabs defaultValue="narasi" className={cn('w-full', className)}>
      <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
        <TabsTrigger value="narasi">Narasi</TabsTrigger>
        <TabsTrigger value="peta">Peta Strategi</TabsTrigger>
        <TabsTrigger value="tokoh">Tokoh</TabsTrigger>
        <TabsTrigger value="fase">Fase</TabsTrigger>
        <TabsTrigger value="sumber">Sumber</TabsTrigger>
      </TabsList>

      <TabsContent value="narasi" className="mt-4">
        <NarrativeTab battle={battle} />
      </TabsContent>

      <TabsContent value="peta" className="mt-4">
        <BattleMap
          latitude={latitude}
          longitude={longitude}
          name={displayName}
          phases={phases}
        />
      </TabsContent>

      <TabsContent value="tokoh" className="mt-4">
        <ParticipantList participants={participants} />
      </TabsContent>

      <TabsContent value="fase" className="mt-4">
        <PhasesTab phases={phases} />
      </TabsContent>

      <TabsContent value="sumber" className="mt-4">
        <CitationsTab
          citations={citations}
          slug={battle.slug}
          isAdmin={isAdmin}
          reingestSnapshot={reingestSnapshot}
        />
      </TabsContent>
    </Tabs>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────

function NarrativeTab({ battle }: { battle: BattleDetailData }) {
  const narrative = battle.narrativeId || battle.narrativeAr
  const narrativeLang = battle.narrativeId ? 'id' : battle.narrativeAr ? 'ar' : null
  const strategy = battle.strategyId || battle.strategyAr
  const significance = battle.significanceId || battle.significanceAr

  if (!narrative && !strategy && !significance) {
    return (
      <TabPlaceholder
        title="Narasi"
        body="Narasi lengkap pertempuran ini sedang dipersiapkan oleh tim reviewer."
      />
    )
  }

  return (
    <article className="prose-athar flex max-w-none flex-col gap-6 text-sm leading-relaxed text-[rgb(var(--text))]">
      {strategy ? (
        <section>
          <h3 className="mb-1 text-base font-semibold text-[rgb(var(--text))]">
            Strategi
          </h3>
          <p className="whitespace-pre-wrap text-[rgb(var(--text-muted))]">{strategy}</p>
        </section>
      ) : null}

      {narrative ? (
        <section
          {...(narrativeLang === 'ar' ? { lang: 'ar', dir: 'rtl' as const } : {})}
          className={narrativeLang === 'ar' ? 'text-base' : undefined}
          style={
            narrativeLang === 'ar'
              ? { fontFamily: 'var(--font-body-arab)' }
              : undefined
          }
        >
          <ReactMarkdown>{narrative}</ReactMarkdown>
        </section>
      ) : null}

      {significance ? (
        <section className="rounded-md border-l-4 border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] p-3">
          <h3 className="mb-1 text-sm font-semibold text-[rgb(var(--text))]">
            Signifikansi
          </h3>
          <p className="text-sm text-[rgb(var(--text-muted))]">{significance}</p>
        </section>
      ) : null}
    </article>
  )
}

function PhasesTab({ phases }: { phases: BattleMapPhase[] }) {
  if (phases.length === 0) {
    return (
      <TabPlaceholder
        title="Fase"
        body="Pertempuran ini belum memiliki rincian fase."
      />
    )
  }
  return (
    <ol className="flex flex-col gap-3">
      {phases.map((phase, idx) => {
        const ord = (phase.phaseOrder ?? idx) + 1
        const titleLatin = phase.titleId || `Fase ${ord}`
        const titleArabic = phase.titleAr
        const desc = phase.descriptionId || phase.descriptionAr
        return (
          <li
            key={phase.id ?? idx}
            className="flex gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--accent))] text-xs font-bold text-white">
              {ord}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium text-[rgb(var(--text))]">{titleLatin}</div>
                {titleArabic ? (
                  <div
                    lang="ar"
                    dir="rtl"
                    className="text-sm text-[rgb(var(--text-muted))]"
                    style={{ fontFamily: 'var(--font-body-arab)' }}
                  >
                    {titleArabic}
                  </div>
                ) : null}
              </div>
              {desc ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-[rgb(var(--text-muted))]">
                  {desc}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

interface CitationsTabProps {
  citations: BattleCitation[]
  slug: string
  isAdmin: boolean
  reingestSnapshot?: BattleReingestCurrentSnapshot
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'baru saja'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`
  return `${Math.floor(diff / 86_400_000)} hari lalu`
}

function CitationsTab({
  citations,
  slug,
  isAdmin,
  reingestSnapshot,
}: CitationsTabProps) {
  const [reingestOpen, setReingestOpen] = React.useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<string | null>(null)

  // Fetch the most recent re-ingest job to show "Data direfresh terakhir".
  // Only runs for admins (the endpoint requires the right permission).
  React.useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    async function load() {
      try {
        const raw = await api.get<unknown>(
          `/admin/battles/${encodeURIComponent(slug)}/re-ingest-jobs`,
        )
        if (cancelled) return
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>)['rows'])
            ? ((raw as Record<string, unknown>)['rows'] as unknown[])
            : null
        if (list && list.length > 0) {
          const first = list[0] as Record<string, unknown>
          const finished =
            (first['finishedAt'] as string | null | undefined) ??
            (first['createdAt'] as string | null | undefined) ??
            null
          setLastRefreshedAt(finished ?? null)
        }
      } catch {
        // 404 is expected on battles that have never been re-ingested.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isAdmin, slug])

  const adminBar = isAdmin ? (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-xs">
      <div className="text-[rgb(var(--text-muted))]">
        {lastRefreshedAt ? (
          <>
            Data direfresh terakhir oleh AI:{' '}
            <span className="font-medium text-[rgb(var(--text))]">
              {formatRelative(lastRefreshedAt)}
            </span>
          </>
        ) : (
          'Pertempuran ini belum pernah direfresh oleh AI.'
        )}
      </div>
      <button
        type="button"
        onClick={() => setReingestOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--text))] hover:border-[rgb(var(--accent))]"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Perbarui sekarang
      </button>
    </div>
  ) : null

  const body =
    citations.length === 0 ? (
      <TabPlaceholder
        title="Sumber"
        body="Daftar citation untuk pertempuran ini akan tampil di sini setelah modul Sumber tersedia."
      />
    ) : (
      <ul className="flex flex-col gap-2">
        {citations.map((c, idx) => (
          <li
            key={c.id ?? idx}
            className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 text-sm"
          >
            <div className="font-medium text-[rgb(var(--text))]">{c.title || 'Tanpa judul'}</div>
            {c.author ? (
              <div className="text-xs text-[rgb(var(--text-muted))]">{c.author}</div>
            ) : null}
            {c.excerpt ? (
              <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">{c.excerpt}</p>
            ) : null}
            {c.url ? (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs text-[rgb(var(--accent))] underline"
              >
                Buka sumber →
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    )

  return (
    <div>
      {adminBar}
      {body}
      {isAdmin ? (
        <BattleReingestDialog
          open={reingestOpen}
          onOpenChange={setReingestOpen}
          slug={slug}
          current={reingestSnapshot}
        />
      ) : null}
    </div>
  )
}

function TabPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
