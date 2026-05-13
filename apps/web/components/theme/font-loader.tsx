// Async server component that emits the runtime font manifest into <head>.
//
// Pattern (FRONTEND.md §9):
//   1. Pull active assignments via the cached server util (no HTTP loop-back).
//   2. Build a single `https://fonts.googleapis.com/css2?...` URL covering
//      every Google-sourced family in one round-trip.
//   3. Inject CSS vars (`--font-display-latin` etc.) inline so Tailwind's
//      `font-display-latin` utility classes resolve immediately.
//
// Mounted in <head> by the root layout (F4 wires it up).  No 'use client',
// no client JS, no hydration cost.
//
// Failure mode: if the DB is unreachable (e.g. preview deploys before
// migrations, or transient outage), we swallow the error and return null —
// `globals.css` has hard-coded fallbacks (`ui-serif`, `system-ui`, …) so the
// app still renders.

import { getActiveThemeFonts } from '@/lib/server/fonts/fetch-active'

// Google Fonts expects spaces in family names as `+` (e.g. `Playfair+Display`).
function encodeFamily(family: string): string {
  return encodeURIComponent(family).replace(/%20/g, '+')
}

function buildGoogleFontsUrl(
  googleFonts: Array<{ family: string; weights: number[]; styles: string[] }>,
): string | null {
  if (googleFonts.length === 0) return null
  const params = googleFonts.map((f) => {
    const weights = (f.weights.length > 0 ? f.weights : [400, 600, 700]).join(';')
    return `family=${encodeFamily(f.family)}:wght@${weights}`
  })
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`
}

// Build a single `:root { ... }` rule with only the assigned slots.  Each
// var falls back to a sensible system stack so unassigned slots still work.
function buildCssVars(fonts: Awaited<ReturnType<typeof getActiveThemeFonts>>): string {
  const lines: string[] = []
  if (fonts.display_latin) {
    lines.push(`--font-display-latin: '${fonts.display_latin}', ui-serif, Georgia, serif;`)
  }
  if (fonts.body_latin) {
    lines.push(`--font-body-latin: '${fonts.body_latin}', ui-sans-serif, system-ui, sans-serif;`)
  }
  if (fonts.display_arab) {
    lines.push(`--font-display-arab: '${fonts.display_arab}', 'Amiri', serif;`)
  }
  if (fonts.section_arab) {
    lines.push(`--font-section-arab: '${fonts.section_arab}', 'Cairo', sans-serif;`)
  }
  if (fonts.body_arab) {
    lines.push(`--font-body-arab: '${fonts.body_arab}', 'Cairo', sans-serif;`)
  }
  if (fonts.quran_arab) {
    lines.push(`--font-quran-arab: '${fonts.quran_arab}', 'Amiri', serif;`)
  }
  if (fonts.mono) {
    lines.push(`--font-mono: '${fonts.mono}', ui-monospace, monospace;`)
  }
  return `:root {\n  ${lines.join('\n  ')}\n}`
}

export async function FontLoader() {
  let fonts: Awaited<ReturnType<typeof getActiveThemeFonts>>
  try {
    fonts = await getActiveThemeFonts()
  } catch {
    // DB down at build/runtime — fall back silently to globals.css defaults.
    return null
  }

  const googleUrl = buildGoogleFontsUrl(fonts.googleFonts)
  const css = buildCssVars(fonts)

  return (
    <>
      {googleUrl && (
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      )}
      {googleUrl && <link rel="stylesheet" href={googleUrl} />}
      {css.includes('--font-') && (
        <style dangerouslySetInnerHTML={{ __html: css }} />
      )}
    </>
  )
}
