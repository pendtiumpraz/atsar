// `<FigureReingestDialog />` — modal wrapper around the admin
// `<FigureReingestPanel />` so admins can re-ingest a figure directly from the
// public detail page (`/figures/[slug]`) without navigating to
// `/admin/figures/[slug]/edit`.
//
// The Panel component already handles the full lifecycle (form → submit →
// poll → diff dialog), so this component is intentionally thin: just a Radix
// Dialog that hosts the existing Card-based form inside.
//
// We pass through the same `currentSnapshot` shape so the diff merge UI
// works identically.

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
  FigureReingestPanel,
  type FigureReingestCurrentSnapshot,
} from '@/components/admin/figures/figure-reingest-panel'

export interface FigureReingestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  current: FigureReingestCurrentSnapshot
}

export function FigureReingestDialog({
  open,
  onOpenChange,
  slug,
  current,
}: FigureReingestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Perbarui via AI Websearch</DialogTitle>
          <DialogDescription>
            Crawl ulang 30 domain whitelist dan sarankan perbaikan untuk
            biografi, citation, dan field kosong. Tinjau diff per field
            sebelum diterapkan.
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 pb-4 sm:px-6">
          {/* The Panel renders its own <Card> with header + form. Inside the
              dialog body the panel's Card border doubles up with the dialog
              border — visually acceptable since the dialog padding gives
              breathing room. Keep the panel intact so all polling/diff state
              flows through unchanged. */}
          <FigureReingestPanel slug={slug} current={current} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
