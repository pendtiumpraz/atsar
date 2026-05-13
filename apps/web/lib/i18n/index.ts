/**
 * Public surface for the web app's i18n layer.
 *
 * Re-exports the locale config and exposes a `getMessages(locale)` helper that
 * loads the JSON message catalog for the requested locale. The dictionary type
 * (`Messages`) is derived from the Indonesian catalog so that every locale must
 * provide the same keys at the type level (callers that strictly cast their
 * catalogs gain compile-time safety).
 */
import arMessages from './messages/ar.json'
import idMessages from './messages/id.json'

import type { Locale } from './config'

export { defaultLocale, isLocale, isRtl, locales, rtlLocales } from './config'
export type { Locale } from './config'

/** Canonical shape of a message dictionary (derived from `id.json`). */
export type Messages = typeof idMessages

/** Top-level message namespaces (e.g. 'common', 'nav', 'auth'). */
export type MessageNamespace = keyof Messages

const dictionaries: Record<Locale, Messages> = {
  id: idMessages,
  ar: arMessages as Messages,
}

/**
 * Returns the message catalog for the given locale.
 *
 * Always produces a dictionary — callers higher up in the request pipeline are
 * responsible for narrowing arbitrary strings into a valid `Locale` via
 * `isLocale(...)` from `./config`.
 */
export function getMessages(locale: Locale): Messages {
  return dictionaries[locale]
}
