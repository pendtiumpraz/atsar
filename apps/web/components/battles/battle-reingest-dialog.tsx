// `<BattleReingestDialog />` — modal wrapper around the admin
// `<BattleReingestPanel />` so admins can re-ingest a battle directly from the
// public detail page (`/battles/[slug]`) without navigating to
// `/admin/battles/[slug]/edit`.
//
// The Panel component already handles the full lifecycle (form → submit →
// poll → diff dialog), so this component is intentionally thin: just a Radix
// Dialog that hosts the existing Card-based form inside.
//
// We pass through the same `current` snapshot shape so the diff merge UI
// works identically to the figure side.

'use client'

import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BattleReingestPanel,
  type BattleReingestCurrentSnapshot,
} from '@/components/admin/battles/battle-reingest-panel'

export interface BattleReingestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  current?: BattleReingestCurrentSnapshot
}

export function BattleReingestDialog({
  open,
  onOpenChange,
  slug,
  current,
}: BattleReingestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Perbarui via AI Websearch</DialogTitle>
          <DialogDescription>
            Crawl ulang 30 domain whitelist dan sarankan perbaikan untuk
            narasi, strategi, signifikansi, dan field lain. Tinjau diff per
            field sebelum diterapkan.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4 sm:px-6">
          <BattleReingestPanel slug={slug} current={current} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
