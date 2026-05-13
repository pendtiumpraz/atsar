/**
 * Theme types and constants.
 *
 * `light` and `dark` are explicit user choices; `auto` follows the OS-level
 * `prefers-color-scheme` media query. The resolved value is always written to
 * `document.documentElement.dataset.theme` as either `light` or `dark` so the
 * CSS variables under `:root[data-theme="..."]` (defined in `app/globals.css`)
 * pick up the right palette.
 */
export type ThemeMode = 'light' | 'dark' | 'auto'

export type ResolvedTheme = 'light' | 'dark'

/** localStorage key — must match the anti-flash inline script in `app/layout.tsx`. */
export const THEME_STORAGE_KEY = 'theme'

/** Default mode when nothing is persisted yet. */
export const DEFAULT_THEME: ThemeMode = 'auto'

export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'auto'] as const

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto'
}
