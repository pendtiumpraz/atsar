'use client'

/**
 * CalendarToggle — Trinary H / M / Both toggle.
 *
 * Spec: docs/UI_UX.md §5.2 — `⊕H/M/Both` with badge state.
 *
 * State strategy:
 *  - Bind to the F7 Zustand store at `@/store/calendar`. Fallback to local
 *    state + `localStorage` if the store hasn't been hydrated yet.
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CalendarMode = 'H' | 'M' | 'Both'

const STORAGE_KEY = 'calendar:mode'
const ORDER: CalendarMode[] = ['H', 'M', 'Both']

interface CalendarStoreApi {
  mode: CalendarMode
  setMode: (m: CalendarMode) => void
}

function useFallbackStore(): CalendarStoreApi {
  const [mode, setModeState] = React.useState<CalendarMode>('Both')

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as CalendarMode | null
      if (stored && ORDER.includes(stored)) setModeState(stored)
    } catch {
      /* ignore */
    }
  }, [])

  const setMode = React.useCallback((m: CalendarMode) => {
    setModeState(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* ignore */
    }
    try {
      document.documentElement.dataset.calendar = m.toLowerCase()
    } catch {
      /* ignore */
    }
  }, [])

  return { mode, setMode }
}

/**
 * Try to bind to the F7 Zustand store at runtime. Falls back to local state
 * if the module isn't present.
 */
function useCalendarStore(): CalendarStoreApi {
  const fallback = useFallbackStore()
  const [external, setExternal] = React.useState<CalendarStoreApi | null>(null)

  React.useEffect(() => {
    let cancelled = false
    import('@/store/calendar')
      .then((mod) => {
        if (cancelled) return
        // Accept a few likely shapes from F7
        const m = mod as Record<string, unknown>
        const hook =
          (m.useCalendarStore as (() => CalendarStoreApi) | undefined) ??
          (m.useCalendar as (() => CalendarStoreApi) | undefined) ??
          (m.default as (() => CalendarStoreApi) | undefined)
        if (typeof hook === 'function') {
          try {
            const value = hook()
            if (value && typeof value.setMode === 'function') {
              setExternal(value)
            }
          } catch {
            /* hook unusable outside React tree — ignore */
          }
        }
      })
      .catch(() => {
        /* store not shipped yet */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return external ?? fallback
}

export function CalendarToggle() {
  const { mode, setMode } = useCalendarStore()

  return (
    <div
      role="group"
      aria-label="Mode kalender"
      className={cn(
        'inline-flex h-8 items-center rounded-full p-0.5',
        'bg-[rgb(var(--bg-elevated))]',
      )}
    >
      {ORDER.map((opt) => {
        const active = mode === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => setMode(opt)}
            aria-pressed={active}
            aria-label={
              opt === 'H' ? 'Hijriyah' : opt === 'M' ? 'Masehi' : 'Keduanya'
            }
            className={cn(
              'h-7 min-w-[28px] px-2 rounded-full text-xs font-semibold',
              'transition-colors',
              active
                ? 'bg-[rgb(var(--surface))] text-[rgb(var(--accent))] shadow-sm'
                : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
            )}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

export default CalendarToggle
