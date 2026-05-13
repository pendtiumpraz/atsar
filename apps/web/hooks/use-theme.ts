'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_THEME,
  isThemeMode,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from '@/lib/theme'

const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(raw) ? raw : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

function readSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia(DARK_MEDIA_QUERY).matches
  } catch {
    return false
  }
}

function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'auto') return systemPrefersDark ? 'dark' : 'light'
  return mode
}

function applyDocumentTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolved
}

/**
 * Best-effort sync of the user's theme preference to the server.
 * Silently swallows errors (e.g. anonymous user, offline, route not yet wired).
 */
function syncThemeToServer(mode: ThemeMode): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  try {
    void fetch('/api/v1/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: mode }),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {
      /* ignore — anonymous users / offline / not yet implemented */
    })
  } catch {
    /* ignore */
  }
}

export interface UseThemeReturn {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  setTheme: (mode: ThemeMode) => void
}

/**
 * Theme hook — single source of truth for the active theme mode.
 *
 * - Reads the initial mode from localStorage (falling back to `auto`).
 * - Tracks `prefers-color-scheme` so `auto` resolves dynamically.
 * - Writes the resolved mode (`light` / `dark`) onto `<html data-theme>` so the
 *   CSS variables in `globals.css` switch palettes immediately.
 * - Persists explicit choices to localStorage and best-effort to the server.
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStoredTheme())
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() =>
    readSystemPrefersDark(),
  )

  // Subscribe to OS-level color scheme changes.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }
    const mq = window.matchMedia(DARK_MEDIA_QUERY)
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches)
    // `addEventListener` is widely supported; fall back for older Safari.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    // Legacy API on MediaQueryList (Safari < 14)
    type LegacyMq = {
      addListener: (fn: (e: MediaQueryListEvent) => void) => void
      removeListener: (fn: (e: MediaQueryListEvent) => void) => void
    }
    ;(mq as unknown as LegacyMq).addListener(onChange)
    return () => {
      ;(mq as unknown as LegacyMq).removeListener(onChange)
    }
  }, [])

  // Cross-tab sync — react to localStorage updates from other tabs/windows.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return
      const next = isThemeMode(e.newValue) ? e.newValue : DEFAULT_THEME
      setThemeState(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const resolvedTheme = resolveTheme(theme, systemPrefersDark)

  // Apply resolved theme to the document whenever it changes.
  useEffect(() => {
    applyDocumentTheme(resolvedTheme)
  }, [resolvedTheme])

  const setTheme = useCallback((mode: ThemeMode) => {
    if (!isThemeMode(mode)) return
    setThemeState(mode)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, mode)
      } catch {
        /* storage may be unavailable (private mode, quota) — ignore */
      }
    }
    syncThemeToServer(mode)
  }, [])

  return { theme, resolvedTheme, setTheme }
}
