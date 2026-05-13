// Compact card for the battles list (WIREFRAMES §12).
//
// Layout:
//   ┌──────────────────────────────────────────┐
//   │ ⚔  Perang Badar                           │   ← name latin + arabic (RTL)
//   │    غزوة بدر                                │
//   │    [Ghazwah]  2 H / 624 M                  │   ← type + date
//   │    Panglima: Nabi ﷺ                         │   ← commander (optional)
//   │    313 vs 1,000           Kemenangan ✓     │   ← force ratio + outcome
//   └──────────────────────────────────────────┘
//
// Renders as a `<Link>` so the whole card is clickable and Next.js prefetches
// the detail route. Theme-aware via CSS variables; Arabic text uses RTL +
// the Arabic body font.

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Loose shape — `battlesApi` returns `any`, so we declare only the fields
// the card renders.  Tighten when the Drizzle-derived `Battle` type lands.
export interface BattleCardData {
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
  commander?: { slug?: string; nameShortId?: string | null; nameFullId?: string | null } | null
}

export interface BattleCardProps {
  battle: BattleCardData
  isActive?: boolean
  href: string
}

const TYPE_LABEL: Record<NonNullable<BattleCardData['type']>, string> = {
  ghazwah: 'Ghazwah',
  sariyyah: 'Sariyyah',
  futuhat: 'Futuhat',
}

const OUTCOME_LABEL: Record<NonNullable<BattleCardData['outcome']>, { label: string; tone: 'success' | 'danger' | 'muted' }> = {
  victory: { label: 'Kemenangan', tone: 'success' },
  defeat: { label: 'Kekalahan', tone: 'danger' },
  truce: { label: 'Gencatan', tone: 'muted' },
  partial: { label: 'Hasil sebagian', tone: 'muted' },
}

function formatYear(ah: number | null | undefined, ce: number | null | undefined): string {
  const parts: string[] = []
  if (typeof ah === 'number') parts.push(`${ah} H`)
  if (typeof ce === 'number') parts.push(`${ce} M`)
  return parts.join(' / ')
}

function formatForceRatio(muslim: number | null | undefined, opponent: number | null | undefined): string | null {
  if (typeof muslim !== 'number' && typeof opponent !== 'number') return null
  const m = typeof muslim === 'number' ? muslim.toLocaleString('id-ID') : '?'
  const o = typeof opponent === 'number' ? opponent.toLocaleString('id-ID') : '?'
  return `${m} vs ${o}`
}

export function BattleCard({ battle, isActive = false, href }: BattleCardProps) {
  const latin = battle.nameId || battle.slug
  const arabic = battle.nameAr
  const typeLabel = battle.type ? TYPE_LABEL[battle.type] : null
  const dateLabel = formatYear(battle.eventDateAh, battle.eventDateCe)
  const force = formatForceRatio(battle.muslimCount, battle.opponentCount)
  const commanderName = battle.commander?.nameShortId || battle.commander?.nameFullId
  const outcomeMeta = battle.outcome ? OUTCOME_LABEL[battle.outcome] : null

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group block rounded-lg border bg-[rgb(var(--surface))] p-3 transition-colors',
        'hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
        isActive
          ? 'border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] shadow-sm'
          : 'border-[rgb(var(--border))]',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'mt-1 text-lg leading-none',
            isActive
              ? 'text-[rgb(var(--accent))]'
              : 'text-[rgb(var(--text-faint))] group-hover:text-[rgb(var(--accent))]',
          )}
        >
          ⚔
        </span>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[rgb(var(--text))]">
              {latin}
            </div>
            {arabic ? (
              <div
                lang="ar"
                dir="rtl"
                className="truncate text-base text-[rgb(var(--text-muted))]"
                style={{ fontFamily: 'var(--font-body-arab)' }}
              >
                {arabic}
              </div>
            ) : null}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]">
            {typeLabel ? (
              <Badge variant="secondary" className="px-2 py-0">
                {typeLabel}
              </Badge>
            ) : null}
            {dateLabel ? (
              <span className="text-[rgb(var(--text-faint))]">{dateLabel}</span>
            ) : null}
          </div>

          {commanderName ? (
            <div className="mt-1 truncate text-xs text-[rgb(var(--text-muted))]">
              Panglima:{' '}
              <span className="font-medium text-[rgb(var(--text))]">{commanderName}</span>
            </div>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            {force ? (
              <span className="text-[rgb(var(--text-muted))]">{force}</span>
            ) : (
              <span />
            )}
            {outcomeMeta ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  outcomeMeta.tone === 'success'
                    ? 'bg-[rgb(var(--success)/0.15)] text-[rgb(var(--success))]'
                    : outcomeMeta.tone === 'danger'
                      ? 'bg-[rgb(var(--danger)/0.15)] text-[rgb(var(--danger))]'
                      : 'bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))]',
                )}
              >
                {outcomeMeta.tone === 'success' ? '✓ ' : ''}
                {outcomeMeta.label}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  )
}
