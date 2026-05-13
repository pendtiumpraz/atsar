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

type ParticipantRole = 'commander' | 'sahabat' | 'fallen' | 'captured'

export interface ParticipantListItem {
  figureId?: string
  role?: ParticipantRole | string | null
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
  { role: 'sahabat', label: 'Sahabat' },
  { role: 'fallen', label: 'Syuhada / Gugur' },
  { role: 'captured', label: 'Tertawan' },
]

export function ParticipantList({ participants, className }: ParticipantListProps) {
  // Group participants by role. Unknown roles are bucketed under 'sahabat'
  // so the UI never silently drops a row.
  const grouped = useMemo(() => {
    const map = new Map<ParticipantRole, ParticipantListItem[]>()
    for (const group of ROLE_GROUPS) map.set(group.role, [])
    for (const p of participants) {
      const role = (p.role && ROLE_GROUPS.some((g) => g.role === p.role) ? p.role : 'sahabat') as ParticipantRole
      map.get(role)!.push(p)
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

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {ROLE_GROUPS.map(({ role, label }) => {
        const rows = grouped.get(role) ?? []
        if (rows.length === 0) return null
        return (
          <section key={role} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-[rgb(var(--text))]">{label}</h3>
              <span className="text-xs text-[rgb(var(--text-faint))]">
                {rows.length} orang
              </span>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {rows.map((p, idx) => (
                <li key={`${role}-${p.figureId ?? idx}`}>
                  <ParticipantMiniCard item={p} />
                </li>
              ))}
            </ul>
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
