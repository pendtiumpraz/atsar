// "Klasik Naskh" PDF template — public slug remains `classic`.
//
// Visual identity: warm cream paper, Naskh Arabic + EB Garamond Latin,
// classical book layout with decorative chapter ornaments, drop caps,
// page-bottom footnotes, and a tiled 8-point Khatam star pattern as a
// low-opacity backdrop on the cover. Modelled on traditional matba'ah
// turāth (classical Arabic press) editions.

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
  chapterOrnamentSvg,
  cornerArabesqueSvg,
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

  const starPattern = islamicStarPattern('#8E7349', 0.10)
  const cornerSvg = cornerArabesqueSvg('#8E7349')
  const yearStamp = dualYearStamp()

  const cover = `
    <section class="cover">
      ${coverImageUrl ? `<div class="cover-photo" style="background-image:url('${escapeHtml(coverImageUrl)}')"></div>` : ''}
      <div class="cover-pattern"></div>
      <div class="cover-corner tl">${cornerSvg}</div>
      <div class="cover-corner tr">${cornerSvg}</div>
      <div class="cover-corner bl">${cornerSvg}</div>
      <div class="cover-corner br">${cornerSvg}</div>

      <div class="cover-inner">
        <p class="cover-imprint">Atsar &middot; Pustaka Salaf</p>

        <div class="cover-titles">
          <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كِتَابُ السِّيْرَةِ')}</h1>
          <div class="cover-ornament">${chapterOrnamentSvg('#8E7349')}</div>
          ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
          ${subtitleId ? `<p class="cover-subtitle">${escapeHtml(subtitleId)}</p>` : ''}
        </div>

        <div class="cover-byline">
          <p class="cover-by-label">disusun oleh</p>
          <p class="cover-author">${escapeHtml(authorName)}</p>
          <p class="cover-generator">Atsar Book Generator</p>
        </div>

        <footer class="cover-footer">
          <span class="cover-wordmark-ar" lang="ar" dir="rtl">أَثَر</span>
          <span class="cover-dot">·</span>
          <span class="cover-wordmark-lat">ATSAR</span>
          <span class="cover-dot">·</span>
          <span class="cover-year">${yearStamp}</span>
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
        style: 'classic',
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
    'Amiri:wght@400;700',
    'Noto+Naskh+Arabic:wght@400;500;700',
    'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400',
    'Inter:wght@400;500;600',
  ])}
  <style>
    ${paletteCss()}

    /* Print sheet rules — cover is full-bleed (margin 0), inside pages
       carry the canonical 28mm/22mm margins, and the first page (cover)
       gets no running header/footer. */
    @page { size: A4; margin: 28mm 22mm 30mm 22mm; }
    @page :first { margin: 0; }
    @page :left  { @bottom-left  { content: counter(page); font-family: 'EB Garamond', serif; font-size: 9pt; color: #6B5E4D; }
                   @top-left     { content: "${escapeCssString((titleId ?? titleAr ?? 'Atsar').toUpperCase())}"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 3px; color: #A89A85; } }
    @page :right { @bottom-right { content: counter(page); font-family: 'EB Garamond', serif; font-size: 9pt; color: #6B5E4D; }
                   @top-right    { content: "ATSAR · KLASIK"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 3px; color: #A89A85; } }

    :root {
      --ornament: #8E7349;
    }

    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'EB Garamond', Georgia, serif;
      color: var(--ink-700);
      background: var(--cream);
    }

    /* ── Cover (full-bleed A4) ─────────────────────────────────── */
    .cover {
      position: relative;
      width: 210mm; height: 297mm;
      background: linear-gradient(160deg, #FAF5EB 0%, #F2EBD9 60%, #E8DFC8 100%);
      page-break-after: always;
      overflow: hidden;
    }
    .cover-photo {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      opacity: 0.18;
      filter: sepia(0.4);
    }
    .cover-pattern {
      position: absolute; inset: 0;
      background-image: ${starPattern};
      background-size: 60mm 60mm;
      opacity: 0.5;
    }
    .cover-corner {
      position: absolute; width: 28mm; height: 28mm;
      color: var(--gold-700);
    }
    .cover-corner.tl { top: 12mm; left: 12mm; }
    .cover-corner.tr { top: 12mm; right: 12mm; transform: scaleX(-1); }
    .cover-corner.bl { bottom: 12mm; left: 12mm; transform: scaleY(-1); }
    .cover-corner.br { bottom: 12mm; right: 12mm; transform: scale(-1, -1); }
    .cover-corner svg { width: 100%; height: 100%; }

    .cover-inner {
      position: relative;
      height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: space-between;
      padding: 38mm 24mm;
      text-align: center;
    }
    .cover-imprint {
      font-family: 'Inter', sans-serif;
      font-size: 9pt;
      letter-spacing: 6px;
      text-transform: uppercase;
      color: var(--gold-700);
      margin: 0;
    }

    .cover-titles { display: flex; flex-direction: column; align-items: center; gap: 6mm; }
    .cover-title-ar {
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
      font-size: 80pt;
      color: var(--emerald-700);
      margin: 0;
      line-height: 1.15;
      font-weight: 700;
      direction: rtl;
    }
    .cover-ornament { width: 60mm; opacity: 0.8; }
    .cover-ornament svg { width: 100%; height: auto; }
    .cover-title-id {
      font-family: 'Cormorant Garamond', 'EB Garamond', serif;
      font-size: 32pt;
      color: var(--ink-900);
      margin: 0;
      font-weight: 600;
      font-style: italic;
    }
    .cover-subtitle {
      font-family: 'EB Garamond', serif;
      font-style: italic;
      font-size: 12pt;
      color: var(--ink-500);
      margin: 0;
      max-width: 120mm;
    }

    .cover-byline {
      display: flex; flex-direction: column; align-items: center; gap: 2mm;
      color: var(--ink-700);
    }
    .cover-by-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt; letter-spacing: 4px; text-transform: uppercase;
      color: var(--ink-300); margin: 0;
    }
    .cover-author {
      font-family: 'Cormorant Garamond', serif;
      font-size: 18pt; font-weight: 600; margin: 0; color: var(--emerald-700);
    }
    .cover-generator {
      font-family: 'EB Garamond', serif; font-style: italic;
      font-size: 11pt; color: var(--ink-500); margin: 0;
    }

    .cover-footer {
      display: flex; gap: 4mm; align-items: center;
      font-family: 'Inter', sans-serif;
      font-size: 9pt; letter-spacing: 2px;
      color: var(--gold-700);
    }
    .cover-wordmark-ar { font-family: 'Amiri', serif; font-size: 14pt; color: var(--emerald-primary); }
    .cover-wordmark-lat { font-weight: 600; }
    .cover-dot { color: var(--gold); }

    /* ── Inside chapter pages ──────────────────────────────────── */
    .fig-page {
      position: relative;
      page-break-before: always;
      padding-top: 4mm;
    }
    .fig-page:first-of-type { page-break-before: avoid; }

    .chapter-head {
      text-align: center;
      margin-bottom: 8mm;
    }
    .chapter-meta {
      font-family: 'Inter', sans-serif;
      font-size: 8pt;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: var(--gold-700);
      margin-bottom: 4mm;
    }
    .chapter-meta .chapter-no { font-weight: 600; }
    .chapter-meta .chapter-of { color: var(--ink-300); margin-left: 2mm; }
    .chapter-titles { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
    .fig-name-ar {
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
      font-size: 32pt; color: var(--emerald-700); margin: 0;
      line-height: 1.2; font-weight: 700; direction: rtl;
    }
    .fig-name-id {
      font-family: 'Cormorant Garamond', 'EB Garamond', serif;
      font-size: 18pt; color: var(--ink-700); margin: 0; font-style: italic; font-weight: 600;
    }
    .chapter-ornament { width: 38mm; opacity: 0.85; line-height: 0; color: var(--ornament); }
    .chapter-ornament svg { width: 100%; height: auto; }

    .pull-quote {
      margin: 6mm 16mm 8mm;
      text-align: center;
      border-top: 0.4pt solid var(--gold-300);
      border-bottom: 0.4pt solid var(--gold-300);
      padding: 4mm 2mm;
    }
    .pull-quote .pq-ar {
      font-family: 'Amiri', serif; font-size: 16pt; color: var(--emerald-primary);
      margin: 0 0 2mm; line-height: 1.6;
    }
    .pull-quote .pq-id {
      font-family: 'EB Garamond', serif; font-style: italic;
      font-size: 12pt; color: var(--ink-700); margin: 0;
    }

    .chapter-body {
      display: grid;
      grid-template-columns: 58mm 1fr;
      gap: 8mm;
    }
    .sidebar-callout {
      border-top: 0.6pt solid var(--gold);
      border-bottom: 0.6pt solid var(--gold);
      padding: 3mm 0;
      font-family: 'Inter', sans-serif;
      font-size: 8.5pt;
      color: var(--ink-700);
      height: fit-content;
    }
    .sidebar-callout h4 {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic; font-weight: 600;
      font-size: 11pt; margin: 0 0 2mm; color: var(--emerald-primary);
      letter-spacing: 0.5px;
    }
    .sidebar-callout dl { margin: 0; }
    .sidebar-callout dt {
      font-size: 7pt; letter-spacing: 2px; text-transform: uppercase;
      color: var(--gold-700); margin-top: 2mm;
    }
    .sidebar-callout dd { margin: 0 0 1mm; }

    .fig-bio {
      font-family: 'EB Garamond', serif;
      font-size: 11pt; line-height: 1.65;
      text-align: justify;
      hyphens: auto;
      -webkit-hyphens: auto;
    }
    .fig-bio p { margin: 0 0 2.5mm; text-indent: 4mm; }
    .fig-bio p.first-para { text-indent: 0; }
    .fig-bio p.first-para::first-letter {
      font-family: 'Cormorant Garamond', serif;
      font-size: 48pt; float: left; line-height: 0.85;
      padding: 1mm 2mm 0 0; color: var(--emerald-700); font-weight: 700;
    }
    .cite-ref {
      font-size: 7pt; color: var(--gold-700);
      vertical-align: super; line-height: 0;
      padding-left: 0.5mm;
    }
    .fig-bio-ar {
      font-family: 'Amiri', 'Noto Naskh Arabic', serif;
      font-size: 14pt; line-height: 1.95;
      direction: rtl; text-align: justify;
      margin-top: 6mm; padding-top: 4mm;
      border-top: 0.4pt dashed var(--gold-300);
    }
    .fig-bio-ar p { margin: 0 0 2mm; }

    .fig-meta-line {
      margin-top: 6mm; padding-top: 3mm;
      border-top: 0.4pt solid var(--gold-300);
      display: flex; flex-wrap: wrap; gap: 6mm;
      font-family: 'Inter', sans-serif;
      font-size: 8pt; color: var(--ink-500);
    }
    .fig-meta-line b {
      color: var(--emerald-primary);
      font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;
      margin-right: 2mm;
    }

    .timeline {
      margin: 6mm 0; padding: 4mm;
      background: var(--cream-200);
      border-left: 2pt solid var(--gold);
    }
    .timeline h4 {
      font-family: 'Inter', sans-serif;
      font-size: 9pt; margin: 0 0 2mm; color: var(--emerald-primary);
      text-transform: uppercase; letter-spacing: 2px;
    }

    .map-placeholder {
      margin: 6mm 0; padding: 5mm;
      text-align: center;
      background: var(--emerald-100);
      border-radius: 1mm;
      font-family: 'Inter', sans-serif;
      font-size: 10pt; color: var(--emerald-primary);
    }
    .map-placeholder .map-hint {
      font-size: 8pt; color: var(--ink-500); margin-top: 1mm;
    }

    .footnotes {
      margin-top: 8mm; padding-top: 3mm;
      border-top: 0.4pt solid var(--gold-300);
      font-family: 'EB Garamond', serif;
      font-size: 9pt; color: var(--ink-700);
    }
    .footnotes h4 {
      font-family: 'Inter', sans-serif;
      font-size: 8pt; margin: 0 0 2mm; color: var(--gold-700);
      text-transform: uppercase; letter-spacing: 2px;
    }
    .footnotes ol { margin: 0; padding-left: 4mm; }
    .footnotes li { margin-bottom: 1mm; }
    .footnotes sup { color: var(--gold-700); font-weight: 700; }
    .footnotes .src { color: var(--ink-300); font-style: italic; }
  </style>
</head>
<body>
  ${cover}
  ${pages}
</body>
</html>`
}
