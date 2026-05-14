// Template registry + shared helpers for PDF templates.
//
// Each template module (`classic.ts`, `modern.ts`, `calligraphy.ts`,
// `minimalist.ts`) exports a `buildHtml(input: TemplateInput): string`
// function. This file:
//   1. Aggregates them into a `templateRegistry` map keyed by slug.
//   2. Exposes `getTemplate(slug)` for the route + worker to look up.
//   3. Hosts shared helpers (escape, palette CSS, figure page renderer,
//      timeline SVG, map placeholder, watermark, ornaments, Hijri year)
//      so the four templates stay DRY and consistent.
//
// Templates intentionally pick from these helpers à-la-carte rather than
// share a single base layout — the visual identity differences between
// the four moods (klasik-naskh / kontemporer / mahasiswa / lentera) need
// divergent page structures, not just CSS variables.

import type {
  figures,
  figureRelations,
  figureLocations,
  citations,
} from '@athar/db/schema'

import { buildHtml as buildClassic } from './classic.js'
import { buildHtml as buildModern } from './modern.js'
import { buildHtml as buildCalligraphy } from './calligraphy.js'
import { buildHtml as buildMinimalist } from './minimalist.js'

// ── Types ─────────────────────────────────────────────────────────────

type FigureRow = typeof figures.$inferSelect
type FigureRelationRow = typeof figureRelations.$inferSelect
type FigureLocationRow = typeof figureLocations.$inferSelect
type CitationRow = typeof citations.$inferSelect

/**
 * Rich figure shape passed into templates: the figure row plus its
 * relations, locations and citations as already-loaded arrays. Keeping
 * templates synchronous (no DB calls in HTML build) lets us render the
 * entire book in a single CPU-bound pass.
 */
export interface FigureRich extends FigureRow {
  relations: FigureRelationRow[]
  locations: FigureLocationRow[]
  /** Citations for this figure — optional so the renderer can degrade. */
  citations?: CitationRow[]
}

/** Language mode for the rendered book, matches the DB enum. */
export type LanguageMode = 'id' | 'ar' | 'both'

/** Shared input shape that every template's `buildHtml` accepts. */
export interface TemplateInput {
  titleAr?: string | null
  titleId?: string | null
  /** Optional subtitle (small italic line under main titles). */
  subtitleId?: string | null
  authorName: string
  authorEmail: string
  figures: FigureRich[]
  languageMode: LanguageMode
  includeIllustrations: boolean
  includeMaps: boolean
  includeTimeline: boolean
  /**
   * Optional cover image URL (low-opacity backdrop behind the cover
   * gradient). If absent, the cover falls back to a CSS arabesque pattern.
   * Wired through the route so admins can later upload covers per figure
   * / book without re-shaping the template signature.
   */
  coverImageUrl?: string | null
}

/** Function signature for a template builder. */
export type BuildFn = (input: TemplateInput) => string

// ── Registry ──────────────────────────────────────────────────────────

/**
 * Slug → builder map. Slugs match the `pdf_templates.slug` column so
 * the route layer can validate the input against this registry.
 *
 * Public slugs stay stable (`classic`, `modern`, `calligraphy`,
 * `minimalist`) but the internal identity of each template was
 * redesigned:
 *   - classic     → "klasik-naskh"  (warm cream, Naskh + Garamond)
 *   - modern      → "kontemporer"    (white grid, Markazi + Inter)
 *   - minimalist  → "mahasiswa"      (study edition, callout boxes)
 *   - calligraphy → "lentera"        (deep navy premium, drop caps)
 */
export const templateRegistry: Record<string, BuildFn> = {
  classic: buildClassic,
  modern: buildModern,
  calligraphy: buildCalligraphy,
  minimalist: buildMinimalist,
}

/**
 * Look up a template builder by slug. Returns `null` if the slug is not
 * registered — the caller decides whether that's a 404 or a fallback to
 * the default ("classic").
 */
export function getTemplate(slug: string): BuildFn | null {
  return templateRegistry[slug] ?? null
}

/** Convenience: list of registered template slugs (for validation, UI). */
export function listTemplateSlugs(): string[] {
  return Object.keys(templateRegistry)
}

// ── Shared rendering helpers ─────────────────────────────────────────
//
// These are imported by each template module to keep their HTML
// generation succinct. They're exported (not just module-local) so a
// template can opt to reuse a helper without re-implementing it.

/**
 * Minimal HTML escape — sufficient for text-node contexts. Templates
 * never put untrusted data into attribute contexts that need extra
 * quoting (we don't accept HTML from user input anywhere here).
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Escape a string for safe inclusion inside a CSS double-quoted string
 * literal (e.g. `content: "..."` inside `@page` running headers).
 * CSS strings allow most characters but `\`, `"`, and newlines must be
 * escaped using the CSS hex-escape `\HH ` syntax for full safety.
 */
export function escapeCssString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\A ')
    .replace(/\r/g, '')
}

/**
 * Google Fonts `<link>` block. Each template now picks its own pair of
 * display + body fonts, so the loader takes a list of family specs and
 * returns a single combined CSS2 import URL.
 *
 * The default set covers every face referenced by the four templates so
 * a template can `fontImports()` with no args and stay portable.
 */
export function fontImports(
  families: string[] = [
    'Amiri:wght@400;700',
    'Aref+Ruqaa:wght@400;700',
    'Lateef:wght@400;700',
    'Scheherazade+New:wght@400;700',
    'Markazi+Text:wght@400;500;600;700',
    'Noto+Naskh+Arabic:wght@400;500;700',
    'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400',
    'Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400',
    'Inter:wght@300;400;500;600;700',
    'Playfair+Display:ital,wght@0,400;0,700;1,400',
  ],
): string {
  const query = families.map((f) => `family=${f}`).join('&')
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${query}&display=swap">`
}

/**
 * Inline CSS variables for the Emerald Turats palette. Pasted into a
 * `<style>` block so every template inherits the same colour tokens.
 * See docs/BRANDING.md §4.
 */
export function paletteCss(): string {
  return `
    :root {
      --emerald-primary: #0F4C3A;
      --emerald-700: #0A3A2C;
      --emerald-500: #1A6B53;
      --emerald-100: #D7E5DE;
      --cream: #FAF5EB;
      --cream-200: #F2EBD9;
      --cream-300: #E8DFC8;
      --gold: #B89968;
      --gold-700: #8E7349;
      --gold-300: #D4BC93;
      --ink-900: #1F1810;
      --ink-700: #3A2E1F;
      --ink-500: #6B5E4D;
      --ink-300: #A89A85;
      --navy-900: #0F1D2E;
      --navy-700: #1A2E48;
      --forest-900: #0F3D2A;
    }
  `
}

/** Fixed-position discreet wordmark used by some templates. */
export function watermark(): string {
  return `<div class="watermark">athar.id</div>`
}

// ── Ornaments + patterns ──────────────────────────────────────────────

/**
 * Inline SVG of an 8-point Islamic star tile. Returned as a `data:` URL
 * suitable for `background-image: url(...)`. Tile size is 60×60 so
 * `background-size: 60mm 60mm` (or similar) tiles cleanly. The SVG body
 * is ~400 bytes once minified.
 *
 * @param strokeColor  Hex colour for stroke (e.g. `#B89968` gold).
 * @param opacity      0–1 stroke opacity baked into the data URL.
 */
export function islamicStarPattern(
  strokeColor: string,
  opacity = 0.12,
): string {
  // 8-point star (overlapping squares = octagram) inside a circle.
  // Tiled, this produces the classic Khatam Sulaiman pattern.
  // We use single quotes inside the SVG so the outer url("…") parses
  // cleanly. The `#` in hex colours must be `%23` for data: URLs.
  const stroke = strokeColor.replace(/#/g, '%23')
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60' width='60' height='60'>` +
    `<g fill='none' stroke='${stroke}' stroke-width='1' opacity='${opacity}'>` +
    `<rect x='12' y='12' width='36' height='36'/>` +
    `<rect x='12' y='12' width='36' height='36' transform='rotate(45 30 30)'/>` +
    `<circle cx='30' cy='30' r='18'/>` +
    `</g></svg>`
  return `url("data:image/svg+xml;utf8,${svg}")`
}

/**
 * Inline SVG used as a centred chapter ornament (thin 3-petal flower
 * with horizontal hairlines). Returned as raw SVG markup; templates drop
 * it inside a `<div class="chapter-ornament">` to centre it.
 */
export function chapterOrnamentSvg(color = '#B89968'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 16" width="120" height="16" aria-hidden="true">
    <line x1="0" y1="8" x2="48" y2="8" stroke="${color}" stroke-width="0.6"/>
    <line x1="72" y1="8" x2="120" y2="8" stroke="${color}" stroke-width="0.6"/>
    <path d="M60 2 L62 8 L60 14 L58 8 Z" fill="${color}"/>
    <circle cx="54" cy="8" r="0.9" fill="${color}"/>
    <circle cx="66" cy="8" r="0.9" fill="${color}"/>
  </svg>`
}

/**
 * Inline SVG of a corner arabesque (top-left orientation). Templates
 * mirror it via CSS transforms for the other three corners.
 */
export function cornerArabesqueSvg(color = '#B89968'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80" aria-hidden="true">
    <g fill="none" stroke="${color}" stroke-width="0.8">
      <path d="M4 4 L40 4 M4 4 L4 40"/>
      <path d="M10 10 Q10 30 30 30 Q30 10 10 10 Z"/>
      <circle cx="20" cy="20" r="2.5"/>
      <path d="M4 50 Q15 60 4 70"/>
      <path d="M50 4 Q60 15 70 4"/>
    </g>
  </svg>`
}

/**
 * Compute current Hijri year (approximate, calendar-arithmetic only).
 * Good enough for a cover stamp — for date-precision work we'd reach for
 * a proper Hijri library, but adding a dep just for one footer is silly.
 */
export function hijriYearApprox(date = new Date()): number {
  // Astronomical / tabular Hijri epoch is 622-07-16 (Julian).
  // 1 Hijri year ≈ 354.367 days.
  const epochUtc = Date.UTC(622, 6, 16)
  const days = (date.getTime() - epochUtc) / 86_400_000
  return Math.floor(days / 354.367) + 1
}

/** "1446 H / 2024 M" style year stamp. */
export function dualYearStamp(date = new Date()): string {
  return `${hijriYearApprox(date)} H · ${date.getFullYear()} M`
}

// ── Figure page rendering ─────────────────────────────────────────────

interface RenderFigurePageInput {
  figure: FigureRich
  index: number
  totalFigures: number
  languageMode: LanguageMode
  includeIllustrations: boolean
  includeMaps: boolean
  includeTimeline: boolean
  /** Style hint so the helper can tune class names per template look. */
  style: 'classic' | 'modern' | 'calligraphy' | 'minimalist'
  renderTimeline: typeof renderTimeline
  renderMapPlaceholder: typeof renderMapPlaceholder
}

/**
 * Render one figure as a fully-styled chapter. Returns a `<section>`
 * (or several stacked) that the template's outer document can drop into
 * the body.
 *
 * Every template gets the same building blocks: chapter heading with
 * Arabic + Latin name separated by a centred ornament, an optional
 * pull-quote, the biography body with drop cap, optional sidebar callout
 * for dates / places / teachers, and a footnotes block when citations
 * are attached. Templates restyle these via class selectors but never
 * reshuffle the information hierarchy.
 */
export function renderFigurePage(input: RenderFigurePageInput): string {
  const {
    figure,
    index,
    totalFigures,
    languageMode,
    includeMaps,
    includeTimeline,
    style,
    renderTimeline: tl,
    renderMapPlaceholder: mp,
  } = input

  const showAr = languageMode === 'ar' || languageMode === 'both'
  const showId = languageMode === 'id' || languageMode === 'both'

  const dates = formatDateRange(figure)
  const kunyah = [figure.kunyahAr, figure.kunyahId].filter(Boolean)
  const laqab = [figure.laqabAr, figure.laqabId].filter(Boolean)
  const bioAr = figure.biographyAr ?? figure.summaryAr ?? ''
  const bioId = figure.biographyId ?? figure.summaryId ?? ''

  // Detect a pull-quote candidate: any sentence in the Arabic summary
  // wrapped in quotes (« » or " ") — typically a famous saying.
  const pullQuoteAr = extractQuote(figure.summaryAr) ?? extractQuote(bioAr)
  const pullQuoteId = extractQuote(figure.summaryId) ?? extractQuote(bioId)

  // Sidebar callout: dates + primary location id (if any) + count of
  // relations. Templates that don't show a sidebar simply hide the box
  // via CSS.
  const sidebar = renderSidebar(figure)

  // Citations footnote list, only when the array is provided & non-empty.
  const cites = figure.citations ?? []
  const footnotes =
    cites.length > 0
      ? `<aside class="footnotes" aria-label="Catatan kaki">
          <h4>Catatan Kaki</h4>
          <ol>${cites
            .map(
              (c, i) =>
                `<li><sup>${i + 1}</sup> ${escapeHtml(
                  c.sourceExcerptId ?? c.sourceExcerptAr ?? c.sourceUrl,
                )} <span class="src">— ${escapeHtml(c.sourceDomain ?? new URL(c.sourceUrl).hostname)}</span></li>`,
            )
            .join('')}</ol>
        </aside>`
      : ''

  const chapterNumber = String(index + 1).padStart(2, '0')
  const chapterTotal = String(totalFigures).padStart(2, '0')

  // Body bio rendered with first <p> getting an extra class so templates
  // that opt into a drop cap can target it precisely.
  const bioIdHtml = bioId ? renderBodyParagraphs(bioId) : ''
  const bioArHtml = bioAr ? renderBodyParagraphs(bioAr) : ''

  return `
  <section class="page fig-page fig-page--${style}" data-figure-index="${index}">
    <header class="chapter-head">
      <div class="chapter-meta">
        <span class="chapter-no">Bab ${chapterNumber}</span>
        <span class="chapter-of">dari ${chapterTotal}</span>
      </div>
      <div class="chapter-titles">
        ${
          showAr
            ? `<h2 class="fig-name-ar" lang="ar" dir="rtl">${escapeHtml(figure.nameFullAr)}</h2>`
            : ''
        }
        <div class="chapter-ornament">${chapterOrnamentSvg('currentColor')}</div>
        ${
          showId
            ? `<h3 class="fig-name-id">${escapeHtml(figure.nameFullId)}</h3>`
            : ''
        }
      </div>
    </header>

    ${
      pullQuoteAr || pullQuoteId
        ? `<blockquote class="pull-quote">
            ${pullQuoteAr ? `<p class="pq-ar" lang="ar" dir="rtl">${escapeHtml(pullQuoteAr)}</p>` : ''}
            ${pullQuoteId ? `<p class="pq-id">&ldquo;${escapeHtml(pullQuoteId)}&rdquo;</p>` : ''}
          </blockquote>`
        : ''
    }

    <div class="chapter-body">
      ${sidebar}
      <div class="fig-body-text">
        ${
          showId && bioIdHtml
            ? `<div class="fig-bio">${bioIdHtml}</div>`
            : ''
        }
        ${
          showAr && bioArHtml
            ? `<div class="fig-bio-ar" lang="ar" dir="rtl">${bioArHtml}</div>`
            : ''
        }
      </div>
    </div>

    <div class="fig-meta-line">
      ${kunyah.length ? `<span><b>Kunyah</b> ${escapeHtml(kunyah.join(' / '))}</span>` : ''}
      ${laqab.length ? `<span><b>Laqab</b> ${escapeHtml(laqab.join(' / '))}</span>` : ''}
      ${dates ? `<span><b>Tarikh</b> ${escapeHtml(dates)}</span>` : ''}
      ${figure.rijalGrade ? `<span><b>Rijal</b> ${escapeHtml(formatRijalGrade(figure.rijalGrade))}</span>` : ''}
    </div>

    ${includeTimeline ? tl(figure) : ''}
    ${includeMaps ? mp(figure) : ''}
    ${footnotes}
  </section>
  `
}

/** Render the sidebar callout block. Templates hide it via CSS if undesired. */
function renderSidebar(figure: FigureRich): string {
  const dates = formatDateRange(figure)
  const locCount = figure.locations?.length ?? 0
  const relCount = figure.relations?.length ?? 0
  const items: string[] = []
  if (dates) items.push(`<dt>Tahun</dt><dd>${escapeHtml(dates)}</dd>`)
  if (figure.madhab)
    items.push(`<dt>Madzhab</dt><dd>${escapeHtml(figure.madhab)}</dd>`)
  if (figure.specialty && figure.specialty.length > 0)
    items.push(
      `<dt>Spesialisasi</dt><dd>${escapeHtml(figure.specialty.join(', '))}</dd>`,
    )
  if (locCount > 0)
    items.push(`<dt>Lokasi</dt><dd>${locCount} tempat terkait</dd>`)
  if (relCount > 0)
    items.push(`<dt>Relasi</dt><dd>${relCount} guru/murid/keluarga</dd>`)
  if (figure.hadithCountMin != null || figure.hadithCountMax != null) {
    const range =
      figure.hadithCountMin != null && figure.hadithCountMax != null
        ? `${figure.hadithCountMin}–${figure.hadithCountMax}`
        : `${figure.hadithCountMin ?? figure.hadithCountMax}`
    items.push(`<dt>Hadits</dt><dd>${escapeHtml(range)} riwayat</dd>`)
  }
  if (items.length === 0) return ''
  return `<aside class="sidebar-callout" aria-label="Ringkasan">
    <h4>Ikhtisar</h4>
    <dl>${items.join('')}</dl>
  </aside>`
}

/** Best-effort dual-calendar date renderer. Returns empty string when missing. */
function formatDateRange(f: FigureRich): string {
  const parts: string[] = []
  const bAh = f.birthDateAh
  const bCe = f.birthDateCe
  const dAh = f.deathDateAh
  const dCe = f.deathDateCe

  if (bAh != null || bCe != null) {
    const ah = bAh != null ? `${bAh} H` : ''
    const ce = bCe != null ? `${bCe} M` : ''
    parts.push(`Lahir ${[ah, ce].filter(Boolean).join(' / ')}`)
  }
  if (dAh != null || dCe != null) {
    const ah = dAh != null ? `${dAh} H` : ''
    const ce = dCe != null ? `${dCe} M` : ''
    parts.push(`Wafat ${[ah, ce].filter(Boolean).join(' / ')}`)
  }
  return parts.join(' · ')
}

/** Convert snake_case enum value into a human label. */
function formatRijalGrade(grade: string): string {
  return grade.replace(/_/g, ' ')
}

/**
 * Wrap a text body into paragraph tags. The first paragraph gets an
 * additional class so templates can hang a drop cap off it. Inline
 * citation markers (`[1]`, `[2]`) are converted to superscript spans
 * so they render at footnote-marker scale.
 */
function renderBodyParagraphs(text: string): string {
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  return paras
    .map((p, i) => {
      const escaped = escapeHtml(p).replace(
        /\[(\d{1,2})\]/g,
        '<sup class="cite-ref">$1</sup>',
      )
      const cls = i === 0 ? 'first-para' : ''
      return `<p${cls ? ` class="${cls}"` : ''}>${escaped}</p>`
    })
    .join('\n')
}

/**
 * Pull the first quoted-string out of a body of text — used as a pull
 * quote candidate. Returns `null` when no quoted span is found.
 */
function extractQuote(text: string | null | undefined): string | null {
  if (!text) return null
  // Try Arabic guillemets first («…»), then curly quotes, then straight.
  const candidates = [
    /«([^»]{12,180})»/,
    /"([^"]{12,180})"/,
    /“([^”]{12,180})”/,
  ]
  for (const re of candidates) {
    const m = text.match(re)
    if (m) return m[1]?.trim() ?? null
  }
  return null
}

// ── Timeline (SVG) ────────────────────────────────────────────────────

/**
 * Render a horizontal SVG timeline plotting birth → death with hijri
 * markers. Kept intentionally small (about 30mm tall) so it slots in
 * between bio paragraphs without dominating the page.
 */
export function renderTimeline(figure: FigureRich): string {
  const start = figure.birthDateAh ?? figure.deathDateAh
  const end = figure.deathDateAh ?? figure.birthDateAh
  if (start == null || end == null) return ''
  if (start === end) return ''

  const span = Math.max(1, end - start)
  // We label up to 5 evenly-spaced ticks across the span.
  const ticks: number[] = []
  for (let i = 0; i <= 4; i++) {
    ticks.push(Math.round(start + (span * i) / 4))
  }

  const width = 500
  const height = 80
  const padX = 30
  const innerW = width - padX * 2

  const tickEls = ticks
    .map((year, i) => {
      const x = padX + (innerW * i) / 4
      return `
        <line x1="${x}" y1="40" x2="${x}" y2="52" stroke="#B89968" stroke-width="1.5" />
        <text x="${x}" y="68" font-family="Inter,sans-serif" font-size="10" fill="#3A2E1F" text-anchor="middle">${year} H</text>`
    })
    .join('')

  return `
    <div class="timeline">
      <h4>Garis Waktu</h4>
      <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Timeline ${escapeHtml(figure.nameFullId)}">
        <line x1="${padX}" y1="40" x2="${width - padX}" y2="40" stroke="#0F4C3A" stroke-width="2" />
        <circle cx="${padX}" cy="40" r="5" fill="#0F4C3A" />
        <circle cx="${width - padX}" cy="40" r="5" fill="#B89968" />
        <text x="${padX}" y="28" font-family="Inter,sans-serif" font-size="10" fill="#0F4C3A" text-anchor="middle">Lahir</text>
        <text x="${width - padX}" y="28" font-family="Inter,sans-serif" font-size="10" fill="#8E7349" text-anchor="middle">Wafat</text>
        ${tickEls}
      </svg>
    </div>
  `
}

// ── Map placeholder ───────────────────────────────────────────────────

/**
 * Render a placeholder block for the figure's primary locations.
 *
 * TODO: swap for a real static map image once the OSM/Mapbox static-tile
 * URL strategy is decided (see IDEAS.md §5b.4 — peta mini). For now we
 * just list the named locations from `figureLocations` so the section
 * isn't empty.
 */
export function renderMapPlaceholder(figure: FigureRich): string {
  const locs = figure.locations ?? []
  if (locs.length === 0) return ''
  return `
    <div class="map-placeholder">
      <b>Peta &mdash; ${locs.length} lokasi terkait</b>
      <div class="map-hint">
        Render peta statis akan menyusul. Lihat
        <code>lib/server/pdf/templates/index.ts</code>.
      </div>
    </div>
  `
}
