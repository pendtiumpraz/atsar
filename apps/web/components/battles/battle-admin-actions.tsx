// `<BattleAdminActions />` — admin-only action cluster shown in the battle
// detail header (top-right of the title card on `/battles/[slug]`).
//
// Mirrors the cluster in <FigureHero />: an "Edit" link to the admin edit
// page + a "Perbarui via AI Websearch" button that opens the
// <BattleReingestDialog /> directly on the public detail page.
//
// Kept as a thin client component so the server `page.tsx` can stay server-
// rendered for SEO; only this slice ships JS.

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Pencil, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { BattleReingestDialog } from './battle-reingest-dialog'
import type { BattleReingestCurrentSnapshot } from '@/components/admin/battles/battle-reingest-panel'

export interface BattleAdminActionsProps {
  slug: string
  current: BattleReingestCurrentSnapshot
}

export function BattleAdminActions({ slug, current }: BattleAdminActionsProps) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/battles/${slug}/edit`}>
          <Pencil className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Edit</span>
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Perbarui via AI Websearch"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Perbarui via AI</span>
      </Button>

      <BattleReingestDialog
        open={open}
        onOpenChange={setOpen}
        slug={slug}
        current={current}
      />
    </div>
  )
}
