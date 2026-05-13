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

import ReactMarkdown from 'react-markdown'

import { BattleMap, type BattleMapPhase } from '@/components/battles/battle-map'
import { ParticipantList, type ParticipantListItem } from '@/components/battles/participant-list'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

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
        <CitationsTab citations={citations} />
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

function CitationsTab({ citations }: { citations: BattleCitation[] }) {
  if (citations.length === 0) {
    return (
      <TabPlaceholder
        title="Sumber"
        body="Daftar citation untuk pertempuran ini akan tampil di sini setelah modul Sumber tersedia."
      />
    )
  }
  return (
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
}

function TabPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
