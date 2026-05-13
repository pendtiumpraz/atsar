// Two-pane shell used by the figures 1-page CRUD pattern (see WIREFRAMES §6,
// FRONTEND §5).
//
// Desktop (≥ lg):
//   ┌─────────┬───────────────┐
//   │  list   │   detail      │
//   └─────────┴───────────────┘
// CSS Grid `1fr 1.5fr` per the wireframe spec.
//
// Mobile (< lg):
//   - When `showDetailOnly` is true (slug present), only the right slot renders.
//   - Otherwise only the left slot renders. Keeps the page focused on a single
//     pane at a time on narrow viewports — back navigation handled by
//     `<BackButton />`.
//
// Pure server-component-safe — no client hooks. Pass JSX into the two slots.

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ListDetailShellProps {
  leftSlot: ReactNode
  rightSlot: ReactNode
  /**
   * When `true`, mobile viewport hides the list and shows only the detail.
   * Typically set to `true` when a slug is selected.
   */
  showDetailOnly?: boolean
  className?: string
}

export function ListDetailShell({
  leftSlot,
  rightSlot,
  showDetailOnly = false,
  className,
}: ListDetailShellProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]',
        className,
      )}
    >
      <aside
        className={cn(
          'min-w-0',
          // Mobile: hide list when detail mode is active.
          showDetailOnly ? 'hidden lg:block' : 'block',
        )}
      >
        {leftSlot}
      </aside>
      <main
        className={cn(
          'min-w-0',
          // Mobile: hide detail pane when no slug selected.
          showDetailOnly ? 'block' : 'hidden lg:block',
        )}
      >
        {rightSlot}
      </main>
    </div>
  )
}
