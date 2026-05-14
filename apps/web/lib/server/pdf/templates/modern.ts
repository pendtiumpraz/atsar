// "Kontemporer" PDF template — public slug remains `modern`.
//
// Visual identity: bright white paper, Markazi Text Arabic + Inter Latin,
// editorial-grade modular grid (two-column inside pages, three-track
// cover). Hairline rules and tiny labels (8pt uppercase) carry the
// information architecture. The cover uses an asymmetric layout with
// the Arabic title in the top-third, Indonesian title aligned to a
// vertical rule, and a single accent line in emerald primary.

import type { TemplateInput } from './index.js'
import {
  escapeHtml,
  escapeCssString,
  fontImports,
  paletteCss,
  renderFigurePage,
  renderTimeline,
  renderMapPlaceholder,
  islamicStarPattern,
  dualYearStamp,
} from './index.js'

export function buildHtml(input: TemplateInput): string {
  const {
    titleAr,
    titleId,
    subtitleId,
    authorName,
    figures,
    languageMode,
    includeIllustrations,
    includeMaps,
    includeTimeline,
    coverImageUrl,
  } = input

  // Subtle pattern as a deep tint at one edge of the cover — gives the
  // page a textured feel without competing with the titles.
  const starPattern = islamicStarPattern('#0F4C3A', 0.08)
  const yearStamp = dualYearStamp()

  const cover = `
    <section class="cover">
      ${coverImageUrl ? `<div class="cover-photo" style="background-image:url('${escapeHtml(coverImageUrl)}')"></div>` : ''}
      <div class="cover-pattern"></div>

      <div class="cover-grid">
        <header class="cover-header">
          <span class="rule"></span>
          <span class="cover-imprint">ATSAR · KONTEMPORER</span>
        </header>

        <div class="cover-titles">
          <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
          ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
          ${subtitleId ? `<p class="cover-subtitle">${escapeHtml(subtitleId)}</p>` : ''}
        </div>

        <aside class="cover-meta">
          <div>
            <span class="label">Penulis</span>
            <span class="value">${escapeHtml(authorName)}</span>
          </div>
          <div>
            <span class="label">Penerbit</span>
            <span class="value">Atsar Book Generator</span>
          </div>
          <div>
            <span class="label">Tahun</span>
            <span class="value">${yearStamp}</span>
          </div>
          <div>
            <span class="label">Jilid</span>
            <span class="value">${figures.length} bab</span>
          </div>
        </aside>

        <footer class="cover-footer">
          <span class="wordmark-ar" lang="ar" dir="rtl">أَثَر</span>
          <span class="cover-dot"></span>
          <span class="wordmark-lat">ATSAR</span>
          <span class="cover-tagline">— Jejak generasi terbaik.</span>
        </footer>
      </div>
    </section>
  `

  const pages = figures
    .map((figure, idx) =>
      renderFigurePage({
        figure,
        index: idx,
        totalFigures: figures.length,
        languageMode,
        includeIllustrations,
        includeMaps,
        includeTimeline,
        style: 'modern',
        renderTimeline,
        renderMapPlaceholder,
      }),
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titleId ?? titleAr ?? 'Atsar — Sirah PDF')}</title>
  ${fontImports([
    'Markazi+Text:wght@400;500;600;700',
    'Amiri:wght@400;700',
    'Inter:wght@300;400;500;600;700',
    'Cormorant+Garamond:ital,wght@0,400;0,600;1,400',
  ])}
  <style>
    ${paletteCss()}

    @page { size: A4; margin: 28mm 22mm; }
    @page :first { margin: 0; }
    @page :left  { @bottom-left  { content: counter(page); font-family: 'Inter', sans-serif; font-size: 8pt; color: #6B5E4D; letter-spacing: 2px; }
                   @top-left     { content: "${escapeCssString((titleId ?? titleAr ?? 'Atsar').toUpperCase())}"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 4px; color: #A89A85; } }
    @page :right { @bottom-right { content: counter(page); font-family: 'Inter', sans-serif; font-size: 8pt; color: #6B5E4D; letter-spacing: 2px; }
                   @top-right    { content: "ATSAR · KONTEMPORER"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 4px; color: #A89A85; } }

    :root { --ornament: #0F4C3A; }

    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--ink-700);
      background: #fff;
    }

    /* ── Cover ─────────────────────────────────────────────────── */
    .cover {
      position: relative;
      width: 210mm; height: 297mm;
      background: #ffffff;
      page-break-after: always;
      overflow: hidden;
    }
    .cover-photo {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      opacity: 0.10;
    }
    .cover-pattern {
      position: absolute; top: 0; right: 0; bottom: 0;
      width: 60mm;
      background-image: ${starPattern};
      background-size: 30mm 30mm;
      opacity: 0.7;
    }
    .cover-grid {
      position: relative;
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto auto;
      padding: 26mm 22mm 22mm 28mm;
      gap: 14mm;
    }

    .cover-header {
      display: flex; align-items: center; gap: 6mm;
    }
    .cover-header .rule {
      display: inline-block; width: 24mm; height: 2pt; background: var(--emerald-primary);
    }
    .cover-imprint {
      font-size: 8pt; font-weight: 600; letter-spacing: 6px;
      color: var(--emerald-primary);
    }

    .cover-titles {
      align-self: end;
      max-width: 150mm;
    }
    .cover-title-ar {
      font-family: 'Markazi Text', 'Amiri', serif;
      font-size: 88pt;
      color: var(--ink-900);
      margin: 0 0 6mm;
      line-height: 1;
      font-weight: 600;
      direction: rtl;
      letter-spacing: -1px;
    }
    .cover-title-id {
      font-family: 'Cormorant Garamond', 'Inter', serif;
      font-size: 32pt;
      color: var(--ink-700);
      margin: 0;
      font-weight: 400;
      font-style: italic;
      max-width: 130mm;
      line-height: 1.15;
      border-left: 1pt solid var(--emerald-primary);
      padding-left: 6mm;
    }
    .cover-subtitle {
      font-family: 'Inter', sans-serif;
      font-size: 11pt;
      color: var(--ink-500);
      margin: 4mm 0 0;
      padding-left: 6mm;
      max-width: 130mm;
    }

    .cover-meta {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4mm;
      padding-top: 6mm;
      border-top: 0.6pt solid var(--cream-300);
    }
    .cover-meta .label {
      display: block;
      font-size: 7pt; letter-spacing: 3px; text-transform: uppercase;
      color: var(--ink-300); margin-bottom: 1mm;
    }
    .cover-meta .value {
      display: block;
      font-size: 11pt; color: var(--ink-900); font-weight: 500;
    }

    .cover-footer {
      display: flex; align-items: center; gap: 4mm;
      padding-top: 4mm;
      border-top: 0.6pt solid var(--cream-300);
      font-size: 8pt;
      color: var(--ink-500);
    }
    .wordmark-ar { font-family: 'Amiri', serif; font-size: 14pt; color: var(--emerald-primary); }
    .wordmark-lat { font-weight: 700; letter-spacing: 3px; color: var(--emerald-primary); }
    .cover-dot { width: 2mm; height: 2mm; background: var(--gold); border-radius: 50%; display: inline-block; }
    .cover-tagline { font-style: italic; }

    /* ── Inside chapter pages ──────────────────────────────────── */
    .fig-page {
      page-break-before: always;
      padding-top: 0;
    }
    .fig-page:first-of-type { page-break-before: avoid; }

    .chapter-head {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 4mm;
      padding-bottom: 6mm;
      border-bottom: 0.6pt solid var(--cream-300);
      margin-bottom: 8mm;
    }
    .chapter-meta {
      font-size: 7pt; letter-spacing: 3px; text-transform: uppercase;
      color: var(--emerald-primary);
      grid-column: 1 / -1;
      display: flex; gap: 3mm; align-items: baseline;
    }
    .chapter-meta .chapter-no { font-weight: 700; }
    .chapter-meta .chapter-of { color: var(--ink-300); }
    .chapter-titles {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 4mm;
    }
    .fig-name-id {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic;
      font-size: 22pt; color: var(--ink-700);
      margin: 0; font-weight: 400;
      grid-column: 1;
    }
    .chapter-ornament { grid-column: 2; width: 30mm; opacity: 0.6; line-height: 0; color: var(--ornament); }
    .chapter-ornament svg { width: 100%; height: auto; }
    .fig-name-ar {
      font-family: 'Markazi Text', 'Amiri', serif;
      font-size: 38pt; color: var(--ink-900);
      margin: 0; line-height: 1; font-weight: 600; direction: rtl;
      grid-column: 3; text-align: left;
    }

    .pull-quote {
      margin: 4mm 0 8mm;
      padding: 6mm 8mm;
      background: #FAFAFA;
      border-left: 3pt solid var(--gold);
    }
    .pull-quote .pq-ar {
      font-family: 'Markazi Text', 'Amiri', serif;
      font-size: 18pt; color: var(--emerald-primary);
      margin: 0 0 2mm; line-height: 1.4;
    }
    .pull-quote .pq-id {
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 13pt; color: var(--ink-700); margin: 0;
    }

    .chapter-body {
      display: grid;
      grid-template-columns: 1fr 52mm;
      gap: 8mm;
    }
    .sidebar-callout {
      grid-column: 2;
      background: #F8F8F8;
      padding: 4mm;
      font-size: 8.5pt;
      color: var(--ink-700);
      height: fit-content;
    }
    .sidebar-callout h4 {
      font-size: 7pt; letter-spacing: 3px; text-transform: uppercase;
      color: var(--emerald-primary); font-weight: 700;
      margin: 0 0 3mm; padding-bottom: 2mm;
      border-bottom: 0.4pt solid var(--cream-300);
    }
    .sidebar-callout dl { margin: 0; }
    .sidebar-callout dt {
      font-size: 7pt; letter-spacing: 1.5px; text-transform: uppercase;
      color: var(--ink-300); margin-top: 2mm;
    }
    .sidebar-callout dd { margin: 0 0 1mm; font-weight: 500; }

    .fig-body-text { grid-column: 1; }
    .fig-bio {
      font-family: 'Inter', sans-serif;
      font-size: 10.5pt; line-height: 1.65; color: var(--ink-700); font-weight: 400;
      text-align: justify; hyphens: auto;
    }
    .fig-bio p { margin: 0 0 3mm; }
    .fig-bio p.first-para::first-letter {
      font-family: 'Cormorant Garamond', serif;
      font-size: 36pt; float: left; line-height: 0.9;
      padding: 1mm 2mm 0 0; color: var(--emerald-primary); font-weight: 700;
    }
    .cite-ref {
      font-size: 7pt; color: var(--emerald-primary);
      vertical-align: super; line-height: 0;
    }
    .fig-bio-ar {
      font-family: 'Markazi Text', 'Amiri', serif;
      font-size: 14pt; line-height: 1.7;
      direction: rtl; text-align: justify;
      margin-top: 6mm; padding-top: 4mm;
      border-top: 0.6pt solid var(--cream-300);
    }
    .fig-bio-ar p { margin: 0 0 2mm; }

    .fig-meta-line {
      margin-top: 8mm; padding: 3mm 0;
      border-top: 0.6pt solid var(--cream-300);
      border-bottom: 0.6pt solid var(--cream-300);
      display: flex; flex-wrap: wrap; gap: 6mm;
      font-size: 8pt; color: var(--ink-500);
    }
    .fig-meta-line b {
      display: inline-block;
      color: var(--emerald-primary); font-weight: 600;
      font-size: 7pt; letter-spacing: 1.5px; text-transform: uppercase;
      margin-right: 1.5mm;
    }

    .timeline { margin: 6mm 0; padding: 4mm 0; }
    .timeline h4 {
      font-size: 7pt; margin: 0 0 2mm; color: var(--emerald-primary);
      text-transform: uppercase; letter-spacing: 3px;
    }

    .map-placeholder {
      margin: 6mm 0; padding: 5mm;
      background: #FAFAFA; border: 0.6pt solid var(--cream-300);
      font-size: 9pt; color: var(--ink-500);
    }
    .map-placeholder b { color: var(--emerald-primary); }
    .map-placeholder .map-hint { font-size: 7pt; color: var(--ink-300); margin-top: 1mm; }

    .footnotes {
      margin-top: 8mm; padding-top: 3mm;
      border-top: 0.6pt solid var(--cream-300);
      font-size: 8.5pt; color: var(--ink-700);
    }
    .footnotes h4 {
      font-size: 7pt; margin: 0 0 2mm; color: var(--emerald-primary);
      text-transform: uppercase; letter-spacing: 3px;
    }
    .footnotes ol { margin: 0; padding-left: 4mm; }
    .footnotes li { margin-bottom: 1mm; }
    .footnotes sup { color: var(--emerald-primary); font-weight: 700; }
    .footnotes .src { color: var(--ink-300); }
  </style>
</head>
<body>
  ${cover}
  ${pages}
</body>
</html>`
}
