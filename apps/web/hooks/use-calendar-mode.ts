'use client'

import { useCallback, useEffect, useState } from 'react'

import type { CalendarMode } from '@athar/shared'

/**
 * Calendar mode hook — single source of truth for the active calendar
 * rendering (`'h'` Hijri, `'m'` Masehi/Gregorian, `'both'`).
 *
 * F7 owns the canonical Zustand store at `@/store/calendar`. When that lands
 * this hook should be replaced with a thin re-export of that store's selector
 * + setter. Until then we fall back to a localStorage-backed implementation
 * mirroring the shape (`useCalendarMode()` returns `{ mode, setMode }`).
 */

const STORAGE_KEY = 'calendar-mode'
const DEFAULT_MODE: CalendarMode = 'both'
const VALID_MODES: readonly CalendarMode[] = ['h', 'm', 'both'] as const

function isCalendarMode(value: unknown): value is CalendarMode {
  return typeof value === 'string' && (VALID_MODES as readonly string[]).includes(value)
}

function readStoredMode(): CalendarMode {
  if (typeof window === 'undefined') return DEFAULT_MODE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return isCalendarMode(raw) ? raw : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export interface UseCalendarModeReturn {
  mode: CalendarMode
  setMode: (mode: CalendarMode) => void
}

export function useCalendarMode(): UseCalendarModeReturn {
  const [mode, setModeState] = useState<CalendarMode>(() => readStoredMode())

  // Cross-tab sync — react to localStorage updates from other tabs/windows.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return
      const next = isCalendarMode(e.newValue) ? e.newValue : DEFAULT_MODE
      setModeState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setMode = useCallback((next: CalendarMode) => {
    if (!isCalendarMode(next)) return
    setModeState(next)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* storage may be unavailable (private mode, quota) — ignore */
      }
    }
  }, [])

  return { mode, setMode }
}
