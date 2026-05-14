// Tab "Peta" — inline MapLibre map for every location linked to the figure.
//
// The actual map is rendered by `figure-location-map.tsx` which we
// `next/dynamic` import with `ssr: false` (MapLibre needs `window`).
// Around the map we render a legend and a grouped list of locations so
// users can scan them without panning.

'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useMemo } from 'react'

import type { FigureDetailData, FigureLocationEntry } from '../figure-detail'

const FigureLocationMap = dynamic(
  () => import('./figure-location-map').then((m) => m.FigureLocationMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-sm text-[rgb(var(--text-muted))]"
        role="status"
        aria-label="Memuat peta"
      >
        Memuat peta…
      </div>
    ),
  },
)

const ROLE_LABELS: Record<FigureLocationEntry['role'], string> = {
  birthplace: 'Tempat lahir',
  residence: 'Domisili',
  dakwah: 'Lokasi dakwah',
  martyr: 'Tempat wafat / gugur',
  burial: 'Tempat pemakaman',
}

const ROLE_BADGE_BG: Record<FigureLocationEntry['role'], string> = {
  birthplace: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  residence: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  dakwah: 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200',
  martyr: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  burial: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
}

const ROLE_DOT: Record<FigureLocationEntry['role'], string> = {
  birthplace: 'bg-green-600',
  residence: 'bg-blue-600',
  dakwah: 'bg-cyan-600',
  martyr: 'bg-red-600',
  burial: 'bg-violet-600',
}

const ROLE_ORDER: FigureLocationEntry['role'][] = [
  'birthplace',
  'residence',
  'dakwah',
  'martyr',
  'burial',
]

export interface FigurePetaTabProps {
  data: FigureDetailData
}

export function FigurePetaTab({ data }: FigurePetaTabProps) {
  const allLocations = data.locations ?? []
  const mappable = useMemo(
    () => allLocations.filter((l) => l.location.coordinates != null),
    [allLocations],
  )

  // Group locations by role for the list. Preserve role-order, then alpha.
  const grouped = useMemo(() => {
    const buckets = new Map<FigureLocationEntry['role'], FigureLocationEntry[]>()
    for (const l of allLocations) {
      const arr = buckets.get(l.role) ?? []
      arr.push(l)
      buckets.set(l.role, arr)
    }
    return ROLE_ORDER.filter((r) => buckets.has(r)).map((r) => ({
      role: r,
      items: (buckets.get(r) ?? []).sort((a, b) =>
        a.location.nameId.localeCompare(b.location.nameId, 'id'),
      ),
    }))
  }, [allLocations])

  if (allLocations.length === 0) {
    return (
      <EmptyState
        title="Belum ada lokasi tercatat"
        body="Tidak ada lokasi tercatat untuk tokoh ini. Setelah penyusunan biografi selesai, tempat lahir, domisili, dan pemakaman akan dipetakan di sini."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {mappable.length > 0 ? (
        <div className="h-[360px] overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]">
          <FigureLocationMap locations={mappable} className="h-full w-full" />
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4 text-xs text-[rgb(var(--text-muted))]">
          Lokasi tercatat tetapi koordinatnya belum dilengkapi — peta belum bisa dirender.
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[rgb(var(--text-muted))]">
        {ROLE_ORDER.map((role) => (
          <span key={role} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${ROLE_DOT[role]}`} />
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>

      {/* Grouped list */}
      <div className="flex flex-col gap-4">
        {grouped.map((g) => (
          <section key={g.role} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
              <span className={`inline-block h-2 w-2 rounded-full ${ROLE_DOT[g.role]}`} />
              {ROLE_LABELS[g.role]}
              <span className="text-xs font-normal lowercase text-[rgb(var(--text-faint))]">
                · {g.items.length}
              </span>
            </h3>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {g.items.map((l) => (
                <li
                  key={l.id}
                  className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/map?location=${encodeURIComponent(l.location.slug)}`}
                      className="font-medium text-[rgb(var(--text))] hover:text-[rgb(var(--primary))]"
                    >
                      {l.location.nameId}
                    </Link>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${ROLE_BADGE_BG[g.role]}`}
                    >
                      {ROLE_LABELS[g.role]}
                    </span>
                  </div>
                  <div
                    dir="rtl"
                    lang="ar"
                    className="mt-0.5 text-[rgb(var(--text-muted))]"
                    style={{ fontFamily: 'var(--font-body-arab)' }}
                  >
                    {l.location.nameAr}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-[rgb(var(--text-faint))]">
                    {l.location.modernName ? <span>{l.location.modernName}</span> : null}
                    {l.location.countryCode ? <span>· {l.location.countryCode}</span> : null}
                    {typeof l.periodStartAh === 'number' || typeof l.periodEndAh === 'number' ? (
                      <span>
                        ·{' '}
                        {typeof l.periodStartAh === 'number' ? `${l.periodStartAh} H` : '—'}
                        {' – '}
                        {typeof l.periodEndAh === 'number' ? `${l.periodEndAh} H` : '—'}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
