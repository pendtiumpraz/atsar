/**
 * Active UI locales for the Athar web app.
 *
 * Note: the shared `Locale` type in `@athar/shared` also includes `'en'`, but
 * English is not yet wired into the UI message catalogs. Keep this list in sync
 * with the JSON files under `./messages/`.
 */
export const locales = ['id', 'ar'] as const

export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'id'

/** Locales that should render right-to-left. */
export const rtlLocales: readonly Locale[] = ['ar'] as const

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value)
}

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale)
}
