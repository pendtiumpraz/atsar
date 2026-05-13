// Template registry + shared helpers for PDF templates.
//
// Each template module (`classic.ts`, `modern.ts`, `calligraphy.ts`,
// `minimalist.ts`) exports a `buildHtml(input: TemplateInput): string`
// function. This file:
//   1. Aggregates them into a `templateRegistry` map keyed by slug.
//   2. Exposes `getTemplate(slug)` for the route + worker to look up.
//   3. Hosts shared helpers (escape, palette CSS, figure page renderer,
//      timeline SVG, map placeholder, watermark) so the four templates
//      stay DRY and consistent.
//
// Templates intentionally pick from these helpers à-la-carte rather than
// share a single base layout — the visual identity differences between
// "classic" (serif book) and "minimalist" (whitespace) need divergent
// page structures, not just CSS variables.

import type { figures, figureRelations, figureLocations } from '@athar/db/schema'

import { buildHtml as buildClassic } from './classic.js'
import { buildHtml as buildModern } from './modern.js'
import { buildHtml as buildCalligraphy } from './calligraphy.js'
import { buildHtml as buildMinimalist } from './minimalist.js'

// ── Types ─────────────────────────────────────────────────────────────

type FigureRow = typeof figures.$inferSelect
type FigureRelationRow = typeof figureRelations.$inferSelect
type FigureLocationRow = typeof figureLocations.$inferSelect

/**
 * Rich figure shape passed into templates: the figure row plus its
 * relations and locations as already-loaded arrays. Keeping templates
 * synchronous (no DB calls in HTML build) lets us render the entire
 * book in a single CPU-bound pass.
 */
export interface FigureRich extends FigureRow {
  relations: FigureRelationRow[]
  locations: FigureLocationRow[]
}

/** Language mode for the rendered book, matches the DB enum. */
export type LanguageMode = 'id' | 'ar' | 'both'

/** Shared input shape that every template's `buildHtml` accepts. */
export interface TemplateInput {
  titleAr?: string | null
  titleId?: string | null
  authorName: string
  authorEmail: string
  figures: FigureRich[]
  languageMode: LanguageMode
  includeIllustrations: boolean
  includeMaps: boolean
  includeTimeline: boolean
}

/** Function signature for a template builder. */
export type BuildFn = (input: TemplateInput) => string

// ── Registry ──────────────────────────────────────────────────────────

/**
 * Slug → builder map. Slugs match the `pdf_templates.slug` column so
 * the route layer can validate the input against this registry.
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
 * Google Fonts `<link>` for Arabic + Latin font families used across
 * templates. Loading all four in one request is cheaper than per-template
 * imports and the network cost is paid once per PDF render.
 */
export function fontImports(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;700&family=Inter:wght@300;400;600&family=Playfair+Display:ital,wght@0,400;0,700;1,400&display=swap">`
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
    }
  `
}

/** Fixed-position watermark used by every template. */
export function watermark(): string {
  return `<div class="watermark">athar.id</div>`
}

// ── Figure page rendering ─────────────────────────────────────────────

interface RenderFigurePageInput {
  figure: FigureRich
  index: number
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
 * Render one figure as a fully-styled page. Returns a `<section>` that
 * the template's outer document can drop into the body.
 *
 * The "style" param picks layout flavours (e.g. classic uses a drop cap,
 * minimalist doesn't) but doesn't change the *information* on the page
 * — every template still shows name, kunyah, dates, bio, optional
 * timeline & map.
 */
export function renderFigurePage(input: RenderFigurePageInput): string {
  const {
    figure,
    index,
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
  const bioAr = figure.biographyAr ?? figure.summaryAr ?? ''
  const bioId = figure.biographyId ?? figure.summaryId ?? ''

  return `
  <section class="page fig-page fig-page--${style}" data-figure-index="${index}">
    ${showAr ? `<h2 class="fig-name-ar" lang="ar" dir="rtl">${escapeHtml(figure.nameFullAr)}</h2>` : ''}
    ${showId ? `<h3 class="fig-name-id">${escapeHtml(figure.nameFullId)}</h3>` : ''}

    <div class="fig-meta">
      ${kunyah.length ? `<span><b>Kunyah:</b> ${escapeHtml(kunyah.join(' / '))}</span>` : ''}
      ${dates ? `<span><b>Dates:</b> ${escapeHtml(dates)}</span>` : ''}
      ${figure.rijalGrade ? `<span><b>Rijal:</b> ${escapeHtml(formatRijalGrade(figure.rijalGrade))}</span>` : ''}
    </div>

    ${
      showId && bioId
        ? `<div class="fig-bio">${renderParagraphs(bioId)}</div>`
        : ''
    }
    ${
      showAr && bioAr
        ? `<div class="fig-bio-ar" lang="ar" dir="rtl">${renderParagraphs(bioAr)}</div>`
        : ''
    }

    ${includeTimeline ? tl(figure) : ''}
    ${includeMaps ? mp(figure) : ''}
  </section>
  `
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

/** Wrap a text body into <p> tags split by blank lines. */
function renderParagraphs(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n')
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
      <h4>Timeline</h4>
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
  // We don't have location names joined in (would need an extra service
  // call) — so we just show the count + IDs as a placeholder list.
  return `
    <div class="map-placeholder">
      <b>Peta &mdash; ${locs.length} lokasi terkait</b>
      <div style="font-size:8pt;color:var(--ink-500);margin-top:2mm;">
        (Static-map render: TODO — see lib/server/pdf/templates/index.ts)
      </div>
    </div>
  `
}
