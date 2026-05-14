// `/admin/battles/[slug]/edit` — minimal edit page for a battle draft.
//
// Surfaces the essential fields (name, type, dates, narrative, outcome,
// status) plus the `<BattleReingestPanel />` for AI-driven refresh. Mirrors
// `/admin/figures/[slug]/edit`.

import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'

import { BattleEditForm } from '@/components/admin/battles/battle-edit-form'
import { BattleReingestPanel } from '@/components/admin/battles/battle-reingest-panel'
import { auth } from '@/lib/server/auth'
import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'
import { battleService } from '@/lib/server/services/battle.service'

interface PageProps {
  params: Promise<{ slug: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  return { title: `Edit Sirah Perang · ${slug} · Admin Atsar` }
}

export default async function AdminBattleEditPage({ params }: PageProps) {
  const { slug } = await params

  // Server-side admin gate — the route itself is also under the (admin)
  // group, but defense-in-depth keeps the page resilient if the layout gate
  // ever loosens.
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  if (!session?.user?.id) {
    redirect('/login')
  }
  const roles = await getUserRoleSlugs(session.user.id)
  if (!roles.has('admin')) {
    redirect('/dashboard')
  }

  let battle
  try {
    battle = await battleService.getBySlug(slug)
  } catch {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <BattleEditForm
        initial={{
          slug: battle.slug,
          nameId: battle.nameId,
          nameAr: battle.nameAr,
          type: battle.type,
          eventDateAh: battle.eventDateAh,
          eventDateCe: battle.eventDateCe,
          narrativeId: battle.narrativeId ?? '',
          outcome: battle.outcome,
          status: battle.status,
        }}
      />

      <BattleReingestPanel slug={battle.slug} />
    </div>
  )
}
