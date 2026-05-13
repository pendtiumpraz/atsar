// `/timeline-ulama` — Ulama Salaf Plus visualisation (WIREFRAMES §9).
//
// Tier gate (IDEAS §6.7):
//   - Free / Sampler / Basic → preview placeholder + upgrade CTA.
//   - Pro / Premium          → full interactive timeline.
//
// `(app)/layout.tsx` already enforces *some* active subscription, so any
// viewer who reaches this route has at least a usable plan.  We just need
// to read its tier to decide what to render.

import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'

import { UlamaSalafPlus } from '@/components/timeline/ulama-salaf-plus'
import { auth, getActiveSubscription } from '@/lib/server/auth'

export const metadata: Metadata = {
  title: 'Timeline Ulama Salaf',
  description:
    'Lihat lintasan generasi Sahabat, Tabi\'in, Tabi\'ut Tabi\'in, dan ulama pasca-salaf dalam satu sumbu waktu.',
}

const PRO_TIERS = new Set(['pro', 'premium'])

export default async function TimelineUlamaPage() {
  // Defensive lookup — outer layout has already gated `userId`, but we
  // re-resolve here because we *also* care about the tier slug.  If for
  // any reason the session is missing we degrade to the preview view.
  let tier: string | null = null
  try {
    const reqHeaders = await headers()
    const session = await auth.api.getSession({ headers: reqHeaders })
    const userId = session?.user?.id
    if (userId) {
      const active = await getActiveSubscription(userId)
      tier = active?.tierSlug ?? null
    }
  } catch {
    // Tolerate auth failures — show the locked preview rather than 500.
    tier = null
  }

  const hasProAccess = tier !== null && PRO_TIERS.has(tier)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Timeline Ulama Salaf
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Lintasan empat generasi sejak Sahabat hingga ulama pasca-salaf.
          </p>
        </div>
        <span className="rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-1 text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
          {hasProAccess ? 'Pro / Premium' : 'Preview'}
        </span>
      </div>

      {hasProAccess ? (
        <UlamaSalafPlus mode="h" />
      ) : (
        <PreviewLocked />
      )}
    </div>
  )
}

function PreviewLocked() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
      <div className="text-sm text-[rgb(var(--text-muted))]">
        Fitur interaktif Timeline Ulama Salaf tersedia mulai tier{' '}
        <span className="font-semibold text-[rgb(var(--text))]">Pro</span>.
      </div>
      <p className="max-w-2xl text-sm text-[rgb(var(--text))]">
        Visualisasi ini menampilkan ratusan ulama lintas generasi dalam satu sumbu waktu,
        dilengkapi filter spesialisasi (Hadits, Fiqh, Tafsir, Aqidah, Lughah), mazhab,
        dan wilayah keilmuan. Tier saat ini memberi akses ke timeline tokoh individu
        dan komparasi multi-tokoh.
      </p>
      <Link
        href="/billing"
        className="inline-flex items-center gap-2 rounded-md bg-[rgb(var(--primary))] px-3 py-2 text-sm font-medium text-[rgb(var(--primary-foreground))] hover:opacity-90"
      >
        Upgrade ke Pro
      </Link>
    </div>
  )
}
