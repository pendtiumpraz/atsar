// Battle participant list (WIREFRAMES §13 — "Tokoh" tab).
//
// Groups participants by role (commander → sahabat → fallen → captured) and
// renders each as a mini figure card that links to `/figures/[slug]`.  Falls
// back gracefully when the join to `figures` returned `null` (the figure was
// soft-deleted or never linked).

'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ParticipantRole =
  | 'commander'
  | 'sub_commander'
  | 'sahabat'
  | 'fallen'
  | 'captured'
  | 'wounded'
  | 'witness'
  | 'flag_bearer'
  | 'envoy'

type ParticipantSide = 'muslim' | 'opponent' | 'both'

export interface ParticipantListItem {
  figureId?: string
  role?: ParticipantRole | string | null
  side?: ParticipantSide | string | null
  notesAr?: string | null
  notesId?: string | null
  figure?: {
    id?: string
    slug?: string
    nameFullAr?: string | null
    nameFullId?: string | null
    nameShortAr?: string | null
    nameShortId?: string | null
  } | null
}

export interface ParticipantListProps {
  participants: ParticipantListItem[]
  className?: string
}

// Display order + Indonesian label for each role.
const ROLE_GROUPS: ReadonlyArray<{ role: ParticipantRole; label: string }> = [
  { role: 'commander', label: 'Panglima' },
  { role: 'sub_commander', label: 'Wakil panglima' },
  { role: 'flag_bearer', label: 'Pembawa panji' },
  { role: 'sahabat', label: 'Sahabat / prajurit' },
  { role: 'fallen', label: 'Syuhada / Gugur' },
  { role: 'wounded', label: 'Terluka' },
  { role: 'captured', label: 'Tertawan' },
  { role: 'envoy', label: 'Utusan' },
  { role: 'witness', label: 'Saksi' },
]

// Display order + Indonesian label for each side.
const SIDE_GROUPS: ReadonlyArray<{ side: ParticipantSide; label: string }> = [
  { side: 'muslim', label: 'Muslim' },
  { side: 'opponent', label: 'Pihak lawan' },
  { side: 'both', label: 'Kedua belah pihak' },
]

export function ParticipantList({ participants, className }: ParticipantListProps) {
  // Group participants first by side (Muslim / Opponent / Both) then by role.
  // Unknown roles bucket under 'sahabat'; unknown sides default to 'muslim'
  // (every legacy row was Muslim-side until Phase 7.5.6 introduced `side`).
  // Sides with zero participants are hidden so single-side battles stay clean.
  const groupedBySide = useMemo(() => {
    const map = new Map<ParticipantSide, Map<ParticipantRole, ParticipantListItem[]>>()
    for (const sideGroup of SIDE_GROUPS) {
      const inner = new Map<ParticipantRole, ParticipantListItem[]>()
      for (const roleGroup of ROLE_GROUPS) inner.set(roleGroup.role, [])
      map.set(sideGroup.side, inner)
    }
    for (const p of participants) {
      const side = (
        p.side && SIDE_GROUPS.some((g) => g.side === p.side) ? p.side : 'muslim'
      ) as ParticipantSide
      const role = (
        p.role && ROLE_GROUPS.some((g) => g.role === p.role) ? p.role : 'sahabat'
      ) as ParticipantRole
      map.get(side)!.get(role)!.push(p)
    }
    return map
  }, [participants])

  if (participants.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-center text-sm text-[rgb(var(--text-muted))]',
          className,
        )}
      >
        Belum ada data peserta yang tercatat untuk pertempuran ini.
      </div>
    )
  }

  // Render every populated side as its own section. Inside each side, show
  // every role bucket that has at least one row.
  const populatedSides = SIDE_GROUPS.filter(({ side }) => {
    const inner = groupedBySide.get(side)
    if (!inner) return false
    let total = 0
    for (const arr of inner.values()) total += arr.length
    return total > 0
  })

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {populatedSides.map(({ side, label }) => {
        const inner = groupedBySide.get(side)!
        let sideTotal = 0
        for (const arr of inner.values()) sideTotal += arr.length
        return (
          <section key={side} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between border-b border-[rgb(var(--border))] pb-1">
              <h2 className="text-base font-semibold text-[rgb(var(--text))]">
                {label}
              </h2>
              <span className="text-xs text-[rgb(var(--text-faint))]">
                {sideTotal} orang
              </span>
            </div>
            <div className="flex flex-col gap-4">
              {ROLE_GROUPS.map(({ role, label: roleLabel }) => {
                const rows = inner.get(role) ?? []
                if (rows.length === 0) return null
                return (
                  <section key={`${side}-${role}`} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-sm font-semibold text-[rgb(var(--text))]">
                        {roleLabel}
                      </h3>
                      <span className="text-xs text-[rgb(var(--text-faint))]">
                        {rows.length} orang
                      </span>
                    </div>
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {rows.map((p, idx) => (
                        <li key={`${side}-${role}-${p.figureId ?? idx}`}>
                          <ParticipantMiniCard item={p} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ParticipantMiniCard({ item }: { item: ParticipantListItem }) {
  const fig = item.figure
  const latin = fig?.nameShortId || fig?.nameFullId || fig?.slug || 'Tokoh tidak diketahui'
  const arabic = fig?.nameShortAr || fig?.nameFullAr
  const note = item.notesId || item.notesAr

  const inner = (
    <div className="flex items-start gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 transition-colors hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]">
      <span aria-hidden className="mt-0.5 text-base text-[rgb(var(--text-faint))]">
        ⌬
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[rgb(var(--text))]">{latin}</div>
        {arabic ? (
          <div
            lang="ar"
            dir="rtl"
            className="truncate text-sm text-[rgb(var(--text-muted))]"
            style={{ fontFamily: 'var(--font-body-arab)' }}
          >
            {arabic}
          </div>
        ) : null}
        {note ? (
          <div className="mt-1 line-clamp-2 text-xs text-[rgb(var(--text-muted))]">{note}</div>
        ) : null}
      </div>
    </div>
  )

  if (!fig?.slug) {
    return (
      <div aria-disabled className="opacity-70">
        {inner}
        <Badge variant="secondary" className="mt-1 text-[10px]">
          Tidak tertaut
        </Badge>
      </div>
    )
  }

  return (
    <Link
      href={`/figures/${encodeURIComponent(fig.slug)}`}
      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] rounded-lg"
    >
      {inner}
    </Link>
  )
}
