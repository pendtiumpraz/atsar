// Calendar mode store — controls how dates are rendered across the app.
//
//   'h'    → Hijri only       (e.g. 11 Rabī al-Awwal 11 H)
//   'm'    → Masehi only      (e.g. 8 June 632 CE)
//   'both' → Show both        (default — matches docs/WIREFRAMES.md §3)
//
// Persisted to `localStorage` under `calendar:store` so the user's
// preferred view survives reloads and is consistent across tabs (via
// Zustand persist + browser storage events on hydration).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarMode } from '@athar/shared'

export interface CalendarState {
  mode: CalendarMode
  setMode: (mode: CalendarMode) => void
  /** Convenience cycle: both → h → m → both. */
  cycle: () => void
}

const NEXT_MODE: Record<CalendarMode, CalendarMode> = {
  both: 'h',
  h: 'm',
  m: 'both',
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      mode: 'both',
      setMode: (mode) => set({ mode }),
      cycle: () => set((s) => ({ mode: NEXT_MODE[s.mode] })),
    }),
    {
      name: 'calendar:store',
      version: 1,
    },
  ),
)
