// `/figures` — list view of the 1-page CRUD pattern.
//
// Server component: reads `searchParams` for filters and forwards them to the
// client-side `<FigureGrid />` (which does the actual TanStack Query fetch so
// the cache survives navigation to / from the detail route).  No data fetched
// here directly — the auth gate already happens in `(app)/layout.tsx`.
//
// Detail pane is intentionally empty until the user picks a tokoh — when they
// do, Next.js routes them to `/figures/[slug]/page.tsx` which renders the
// detail in the right slot.
//
// Wireframes: docs/WIREFRAMES.md §6, FRONTEND.md §5.

import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { FigureCategoryTabs } from '@/components/figures/figure-category-tabs'
import { FigureFilterBar } from '@/components/figures/figure-filter-bar'
import { FigureGrid } from '@/components/figures/figure-grid'
import { FigureIngestQuickAdd } from '@/components/figures/figure-ingest-quick-add'
import { ListDetailShell } from '@/components/figures/list-detail-shell'
import { auth } from '@/lib/server/auth'
import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'

export const metadata: Metadata = {
  title: 'Tokoh',
  description:
    'Jelajahi koleksi tokoh Nabi, Sahabat, Tabi\'in, dan ulama salaf di Atsar.',
}

// Next 15: `searchParams` is async.
interface FiguresPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

export default async function FiguresPage({ searchParams }: FiguresPageProps) {
  const sp = await searchParams
  const q = pick(sp.q)
  const category = pick(sp.category)
  const genderRaw = pick(sp.gender)
  const gender = genderRaw === 'male' || genderRaw === 'female' ? genderRaw : undefined
  const pageRaw = pick(sp.page)
  const page = pageRaw ? Math.max(1, Number(pageRaw) || 1) : 1

  // Show the admin-only "Sampah" pill if the viewer is in the admin role.
  // Cheap — the session lookup is already cached for this request thanks to
  // the surrounding (app) layout having read it once.
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const isAdmin = session?.user?.id
    ? (await getUserRoleSlugs(session.user.id)).has('admin')
    : false

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Tokoh
        </h1>
        {isAdmin && <FigureIngestQuickAdd />}
      </div>

      <FigureCategoryTabs showTrash={isAdmin} />
      <FigureFilterBar />

      <ListDetailShell
        leftSlot={
          <FigureGrid query={{ q, category, gender, page }} />
        }
        rightSlot={
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-8 text-center">
            <div className="max-w-xs text-sm text-[rgb(var(--text-muted))]">
              <div className="mb-2 text-2xl text-[rgb(var(--text-faint))]" aria-hidden>
                ⌬
              </div>
              Pilih tokoh dari daftar untuk melihat detailnya.
            </div>
          </div>
        }
      />
    </div>
  )
}
