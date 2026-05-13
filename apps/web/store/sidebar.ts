// Sidebar collapse state.
//
// Persisted to `localStorage` under `sidebar:store` so the user's preference
// survives reloads. Default is `collapsed: false` (open), matching the
// desktop-first layout in `docs/WIREFRAMES.md`.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SidebarState {
  collapsed: boolean
  toggle: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      toggle: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
    }),
    {
      name: 'sidebar:store',
      version: 1,
    },
  ),
)
