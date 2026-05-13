import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * Anti-flash theme script (server component).
 *
 * Renders an inline `<script>` that synchronously reads the persisted theme
 * preference from localStorage (or falls back to `prefers-color-scheme`) and
 * sets `document.documentElement.dataset.theme` BEFORE any CSS is applied.
 * This prevents the "flash of wrong theme" (FOWT) on first paint.
 *
 * Must be rendered inside `<head>` and BEFORE the global stylesheet. See
 * `docs/UI_UX.md` §2 (motion, anti-flash).
 *
 * Note: `app/layout.tsx` currently inlines an equivalent snippet directly.
 * This component exists so the integrator (F4) can drop it in instead, keeping
 * the storage key consistent with `lib/theme.ts`.
 */
export function AntiFlashScript() {
  // NOTE: this string runs in the browser before React hydrates. Keep it
  // dependency-free, ES5-compatible, and wrapped in try/catch.
  const script = `(function(){try{var k=${JSON.stringify(
    THEME_STORAGE_KEY,
  )};var s=localStorage.getItem(k)||'auto';var d=s==='dark'||(s==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
