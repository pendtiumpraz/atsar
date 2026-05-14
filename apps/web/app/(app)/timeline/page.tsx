// `/timeline` — multi-tokoh comparison view (WIREFRAMES §8).
//
// Server component.  Auth + subscription gating already happens in the
// `(app)/layout.tsx`, so this file only needs to:
//   1. Read `?ids=a,b,c` from the URL (Next 15: async searchParams).
//   2. Render the header + client-side <ComparisonPicker /> +
//      <ComparisonTimelineView />.
//
// State for the comparison lives in the URL — picker writes, timeline
// reads.  Loose coupling lets the two components live anywhere on the
// page without sharing a context provider.

import type { Metadata } from 'next'

import { ComparisonPicker } from '@/components/timeline/comparison-picker'
import { ComparisonTimelineView } from '@/components/timeline/timeline-comparison'

export const metadata: Metadata = {
  title: 'Timeline Komparasi',
  description:
    'Bandingkan rentang hidup hingga lima tokoh secara berdampingan dalam satu sumbu waktu Hijriyah / Masehi.',
}

interface TimelinePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function TimelinePage({ searchParams }: TimelinePageProps) {
  const sp = await searchParams
  const idsRaw = pick(sp.ids) ?? ''
  const initialIds = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Timeline Komparasi
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Pilih hingga 12 tokoh untuk dibandingkan rentang hidupnya pada satu sumbu waktu.
          </p>
        </div>
      </div>

      <ComparisonPicker initialIds={initialIds} />

      <ComparisonTimelineView mode="h" />
    </div>
  )
}
