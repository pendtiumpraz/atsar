// Font preview pane — renders sample text in a given font, loading the
// font on-the-fly from Google Fonts / custom URL / uploaded files.
//
// Strategy:
//   - Google Fonts source → inject a `<link rel="stylesheet">` pointing at
//     the CSS2 endpoint (covers Arab + Latin via &subset=arabic). The
//     stylesheet itself triggers the actual woff2 fetches.
//   - Custom URL source     → inject a `@font-face` <style> rule pointing at
//     the URL (assumes admin entered the full CSS or font-file URL).
//   - Uploaded source       → inject `@font-face` rules from `filePaths`.
//
// All injected nodes are tagged with `data-atsar-font-preview="<key>"` and
// cleaned up on unmount or when the preview switches to a different font,
// so a long-lived dialog never leaks <link>s.
//
// IMPORTANT: the preview pane shows BOTH Arab + Latin samples regardless of
// the font's script — for an Arab font the Latin sample will fall back to
// the system stack, which is the intended visual hint for the admin.
// See docs/IDEAS.md §3b.4.

'use client'

import { useEffect, useId, useMemo } from 'react'

import { cn } from '@/lib/utils'

export type FontPreviewSource = 'google_fonts' | 'custom_url' | 'uploaded'
export type FontPreviewScript = 'latin' | 'arabic' | 'mono' | 'both'

export interface FontPreviewProps {
  /** Stable key — used to de-dupe injected <link>/<style> nodes. */
  fontId: string
  /** CSS font-family name to apply to the preview text. */
  family: string
  source: FontPreviewSource
  script: FontPreviewScript
  /** Google Fonts family name (e.g. "Playfair Display"). */
  googleFamilyName?: string | null
  /** Direct stylesheet or font-file URL for `custom_url` source. */
  customUrl?: string | null
  /** Map of `weight[_style]` → absolute font-file URL for `uploaded` source. */
  filePaths?: Record<string, string> | null
  /** Weights to request when loading from Google (defaults to [400, 700]). */
  weights?: number[] | null
  /** Optional override for the Arab sample text. */
  sampleAr?: string | null
  /** Optional override for the Latin sample text. */
  sampleId?: string | null
  className?: string
}

const DEFAULT_SAMPLE_AR_LINES = ['بسم الله الرحمن الرحيم', 'سيرة الصحابة']
const DEFAULT_SAMPLE_LATIN_LINES = [
  'The quick brown fox jumps over the lazy dog',
  'Atsar — Jejak generasi terbaik',
]

/**
 * Build a Google Fonts CSS2 URL for a family + weights.  We always request
 * `display=swap` so the fallback shows immediately while the woff2 streams.
 */
function buildGoogleFontsHref(family: string, weights: number[] | null | undefined): string {
  const ws = (weights ?? [400, 700])
    .filter((w) => Number.isFinite(w) && w >= 100 && w <= 900)
    .sort((a, b) => a - b)
  const wParam = ws.length > 0 ? `:wght@${ws.join(';')}` : ''
  const encoded = encodeURIComponent(family).replace(/%20/g, '+')
  return `https://fonts.googleapis.com/css2?family=${encoded}${wParam}&display=swap`
}

/**
 * Emit `@font-face` rules for an uploaded font.  Keys are expected to be
 * either `"400"` (weight only, normal style) or `"400_italic"`.
 */
function buildFontFaceCss(family: string, filePaths: Record<string, string>): string {
  const lines: string[] = []
  for (const [key, url] of Object.entries(filePaths)) {
    if (!url) continue
    const [weightPart, stylePart] = key.split('_')
    const weight = /^\d+$/.test(weightPart ?? '') ? weightPart : '400'
    const style = stylePart === 'italic' ? 'italic' : 'normal'
    lines.push(
      [
        '@font-face {',
        `  font-family: '${family.replace(/'/g, "\\'")}';`,
        `  src: url('${url}');`,
        `  font-weight: ${weight};`,
        `  font-style: ${style};`,
        '  font-display: swap;',
        '}',
      ].join('\n'),
    )
  }
  return lines.join('\n\n')
}

export function FontPreview(props: FontPreviewProps) {
  const {
    fontId,
    family,
    source,
    script,
    googleFamilyName,
    customUrl,
    filePaths,
    weights,
    sampleAr,
    sampleId,
    className,
  } = props

  // Use a per-render unique tag so two <FontPreview /> instances showing
  // different fonts cannot stomp each other.
  const reactId = useId()
  const tag = `${reactId}:${fontId}`

  useEffect(() => {
    const head = document.head
    if (!head) return
    const created: HTMLElement[] = []

    if (source === 'google_fonts' && googleFamilyName) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = buildGoogleFontsHref(googleFamilyName, weights)
      link.dataset.atsarFontPreview = tag
      head.appendChild(link)
      created.push(link)
    } else if (source === 'custom_url' && customUrl) {
      // We don't know whether the URL is a CSS file or a raw woff2, so try
      // both: a <link> takes precedence (no-ops if URL is not CSS) and a
      // backup @font-face rule covers raw font-file URLs.
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = customUrl
      link.dataset.atsarFontPreview = tag
      head.appendChild(link)
      created.push(link)

      const style = document.createElement('style')
      style.dataset.atsarFontPreview = tag
      style.textContent = `@font-face {\n  font-family: '${family.replace(/'/g, "\\'")}';\n  src: url('${customUrl}');\n  font-display: swap;\n}`
      head.appendChild(style)
      created.push(style)
    } else if (source === 'uploaded' && filePaths && Object.keys(filePaths).length > 0) {
      const style = document.createElement('style')
      style.dataset.atsarFontPreview = tag
      style.textContent = buildFontFaceCss(family, filePaths)
      head.appendChild(style)
      created.push(style)
    }

    return () => {
      for (const node of created) {
        node.parentElement?.removeChild(node)
      }
    }
  }, [tag, family, source, googleFamilyName, customUrl, filePaths, weights])

  const fontFamilyValue = useMemo(() => {
    // Add sensible system fallbacks based on script.
    const safe = `'${family.replace(/'/g, "\\'")}'`
    if (script === 'mono') return `${safe}, ui-monospace, SFMono-Regular, Menlo, monospace`
    if (script === 'arabic') return `${safe}, 'Amiri', 'Noto Naskh Arabic', serif`
    return `${safe}, system-ui, -apple-system, 'Segoe UI', sans-serif`
  }, [family, script])

  const arabLines = (sampleAr?.trim() ? [sampleAr] : DEFAULT_SAMPLE_AR_LINES)
  const latinLines = (sampleId?.trim() ? [sampleId] : DEFAULT_SAMPLE_LATIN_LINES)

  const showArab = script === 'arabic' || script === 'both'
  const showLatin = script === 'latin' || script === 'mono' || script === 'both'

  return (
    <div
      className={cn(
        'space-y-4 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4',
        className,
      )}
      aria-label={`Pratinjau font ${family}`}
    >
      <div className="flex items-center justify-between text-xs text-[rgb(var(--text-faint))]">
        <span>{family}</span>
        <span className="uppercase tracking-wide">{source.replace('_', ' ')}</span>
      </div>

      {showArab ? (
        <div className="space-y-2" dir="rtl" lang="ar">
          {arabLines.map((line, idx) => (
            <p
              key={idx}
              className="text-2xl leading-relaxed text-[rgb(var(--text))]"
              style={{ fontFamily: fontFamilyValue }}
            >
              {line}
            </p>
          ))}
        </div>
      ) : null}

      {showLatin ? (
        <div className="space-y-2">
          {latinLines.map((line, idx) => (
            <p
              key={idx}
              className={cn(
                'text-[rgb(var(--text))]',
                idx === 0 ? 'text-xl' : 'text-base text-[rgb(var(--text-muted))]',
              )}
              style={{ fontFamily: fontFamilyValue }}
            >
              {line}
            </p>
          ))}
          <p
            className="text-xs text-[rgb(var(--text-faint))]"
            style={{ fontFamily: fontFamilyValue }}
          >
            ABCDEFGHIJKLM abcdefghijklm 0123456789
          </p>
        </div>
      ) : null}
    </div>
  )
}
