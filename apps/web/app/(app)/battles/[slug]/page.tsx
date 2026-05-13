// `/battles/[slug]` — detail view for a single battle (WIREFRAMES §13).
//
// Server component. Fetches the battle (with phases + participant count via
// `battleService.getBySlug`) plus participant list, then hands everything to
// the client `<BattleDetail />` for tab rendering + map interaction.
//
// Auth + subscription gated by `(app)/layout.tsx`. We trigger `notFound()`
// when the slug doesn't resolve so Next.js renders the 404 page.

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BattleDetail, type BattleDetailData } from '@/components/battles/battle-detail'
import type { BattleMapPhase } from '@/components/battles/battle-map'
import type { ParticipantListItem } from '@/components/battles/participant-list'
import { ApiError } from '@/lib/server/api'
import { battleService } from '@/lib/server/services/battle.service'

interface BattleDetailPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function loadBattle(slug: string) {
  try {
    return await battleService.getBySlug(slug)
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') return null
    throw err
  }
}

async function loadParticipants(slug: string) {
  try {
    return await battleService.listParticipants(slug)
  } catch {
    // Non-fatal — show an empty Tokoh tab instead of failing the whole page.
    return []
  }
}

export async function generateMetadata(
  { params }: BattleDetailPageProps,
): Promise<Metadata> {
  const { slug } = await params
  const battle = await loadBattle(slug)
  if (!battle) return { title: 'Pertempuran tidak ditemukan' }
  const title = battle.nameId || battle.nameAr || slug
  const description =
    battle.significanceId ||
    battle.significanceAr ||
    battle.strategyId ||
    battle.strategyAr ||
    undefined
  return { title, description }
}

export default async function BattleDetailPage({
  params,
  searchParams,
}: BattleDetailPageProps) {
  const { slug } = await params
  const sp = await searchParams

  const [battle, participants] = await Promise.all([
    loadBattle(slug),
    loadParticipants(slug),
  ])

  if (!battle) notFound()

  const phases = battle.phases ?? []
  const data = battle as unknown as BattleDetailData
  const latin = data.nameId || slug
  const arabic = data.nameAr
  const date = formatYear(data.eventDateAh, data.eventDateCe)

  const backHref = buildBackHref(sp)

  return (
    <div className="flex flex-col gap-4">
      {/* Header: back + title + meta */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-sm hover:border-[rgb(var(--accent))]"
          >
            ← Kembali
          </Link>
          {/* Placeholder action area (PDF export etc.) — left for F18. */}
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:p-5">
          {arabic ? (
            <h1
              lang="ar"
              dir="rtl"
              className="text-3xl font-semibold leading-tight text-[rgb(var(--text))] sm:text-4xl"
              style={{ fontFamily: 'var(--font-display-arab)' }}
            >
              {arabic}
            </h1>
          ) : null}
          <div className="text-lg font-medium text-[rgb(var(--text-muted))]">
            {latin}
            {date ? <span className="text-[rgb(var(--text-faint))]"> · {date}</span> : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
            {data.type ? (
              <span>
                Jenis:{' '}
                <span className="font-medium text-[rgb(var(--text))]">{labelType(data.type)}</span>
              </span>
            ) : null}
            {typeof data.muslimCount === 'number' || typeof data.opponentCount === 'number' ? (
              <span>
                Kekuatan:{' '}
                <span className="font-medium text-[rgb(var(--text))]">
                  {(data.muslimCount ?? '?').toLocaleString?.('id-ID') ?? data.muslimCount ?? '?'} vs{' '}
                  {(data.opponentCount ?? '?').toLocaleString?.('id-ID') ?? data.opponentCount ?? '?'}
                </span>
              </span>
            ) : null}
            {typeof data.casualtiesMuslim === 'number' ? (
              <span>
                Syuhada:{' '}
                <span className="font-medium text-[rgb(var(--text))]">{data.casualtiesMuslim}</span>
              </span>
            ) : null}
            {data.outcome ? (
              <span>
                Hasil:{' '}
                <span className="font-medium text-[rgb(var(--text))]">{labelOutcome(data.outcome)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tabs (client component owns Radix state + map interaction) */}
      <BattleDetail
        battle={data}
        phases={phases as unknown as BattleMapPhase[]}
        participants={participants as unknown as ParticipantListItem[]}
      />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function formatYear(ah: number | null | undefined, ce: number | null | undefined): string {
  const parts: string[] = []
  if (typeof ah === 'number') parts.push(`${ah} H`)
  if (typeof ce === 'number') parts.push(`${ce} M`)
  return parts.join(' / ')
}

function labelType(type: string): string {
  switch (type) {
    case 'ghazwah': return 'Ghazwah'
    case 'sariyyah': return 'Sariyyah'
    case 'futuhat': return 'Futuhat'
    default: return type
  }
}

function labelOutcome(outcome: string): string {
  switch (outcome) {
    case 'victory': return 'Kemenangan'
    case 'defeat': return 'Kekalahan'
    case 'truce': return 'Gencatan senjata'
    case 'partial': return 'Hasil sebagian'
    default: return outcome
  }
}

function buildBackHref(sp: Record<string, string | string[] | undefined>): string {
  const next = new URLSearchParams()
  for (const key of ['q', 'type', 'fromAh', 'toAh', 'locationId', 'page'] as const) {
    const raw = sp[key]
    const v = Array.isArray(raw) ? raw[0] : raw
    if (v) next.set(key, v)
  }
  const qs = next.toString()
  return qs ? `/battles?${qs}` : '/battles'
}
