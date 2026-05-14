// "Lentera" (premium presentation) PDF template — public slug remains `calligraphy`.
//
// Visual identity: deep navy / dark green accents, Aref Ruqaa display +
// EB Garamond body, oversized drop caps, full-bleed Islamic geometric
// pattern on the cover, and a gold-leaf trim. Mood: a hardback gift
// edition you'd keep on a coffee table. Both cover and chapter openers
// place the Arabic title and Latin title on a single composed plate
// rather than stacked blocks.

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

  // Premium edition uses gold-on-navy for the cover pattern.
  const goldStar = islamicStarPattern('#D4BC93', 0.16)
  const corner = cornerArabesqueSvg('#D4BC93')
  const yearStamp = dualYearStamp()

  const cover = `
    <section class="cover">
      ${coverImageUrl ? `<div class="cover-photo" style="background-image:url('${escapeHtml(coverImageUrl)}')"></div>` : ''}
      <div class="cover-pattern"></div>
      <div class="cover-vignette"></div>

      <div class="cover-corner tl">${corner}</div>
      <div class="cover-corner tr">${corner}</div>
      <div class="cover-corner bl">${corner}</div>
      <div class="cover-corner br">${corner}</div>

      <div class="cover-inner">
        <p class="cover-imprint">ATSAR &middot; EDISI LENTERA</p>

        <div class="cover-plate">
          <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
          <div class="cover-ornament">${chapterOrnamentSvg('#D4BC93')}</div>
          ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
          ${subtitleId ? `<p class="cover-subtitle">${escapeHtml(subtitleId)}</p>` : ''}
        </div>

        <div class="cover-byline">
          <p class="cover-by-label">disusun oleh</p>
          <p class="cover-author">${escapeHtml(authorName)}</p>
          <p class="cover-generator">Atsar Book Generator</p>
        </div>

        <footer class="cover-footer">
          <div class="cover-rule"></div>
          <div class="cover-wordmark">
            <span class="wm-ar" lang="ar" dir="rtl">أَثَر</span>
            <span class="wm-dot">·</span>
            <span class="wm-lat">ATSAR</span>
            <span class="wm-dot">·</span>
            <span class="wm-year">${yearStamp}</span>
          </div>
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
        style: 'calligraphy',
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
    'Aref+Ruqaa:wght@400;700',
    'Amiri:wght@400;700',
    'EB+Garamond:ital,wght@0,400;0,600;0,700;1,400',
    'Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400',
    'Inter:wght@400;500;600',
  ])}
  <style>
    ${paletteCss()}

    @page { size: A4; margin: 28mm 22mm 32mm 22mm; }
    @page :first { margin: 0; }
    @page :left  { @bottom-left  { content: counter(page); font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 10pt; color: #8E7349; }
                   @top-left     { content: "${escapeCssString((titleId ?? titleAr ?? 'Atsar').toUpperCase())}"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 4px; color: #A89A85; } }
    @page :right { @bottom-right { content: counter(page); font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 10pt; color: #8E7349; }
                   @top-right    { content: "ATSAR · LENTERA"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 4px; color: #A89A85; } }

    :root { --ornament: #D4BC93; }

    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'EB Garamond', Georgia, serif;
      color: var(--ink-900);
      background: #FBF8F0;
    }

    /* ── Cover (full-bleed A4, deep navy) ──────────────────────── */
    .cover {
      position: relative;
      width: 210mm; height: 297mm;
      background: radial-gradient(ellipse at 50% 30%, #1A2E48 0%, #0F1D2E 70%, #08111B 100%);
      color: #F5EAD2;
      page-break-after: always;
      overflow: hidden;
    }
    .cover-photo {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      opacity: 0.22; mix-blend-mode: lighten;
    }
    .cover-pattern {
      position: absolute; inset: 0;
      background-image: ${goldStar};
      background-size: 50mm 50mm;
    }
    .cover-vignette {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(8,17,27,0.65) 100%);
    }
    .cover-corner {
      position: absolute; width: 32mm; height: 32mm; color: var(--gold-300);
    }
    .cover-corner.tl { top: 14mm; left: 14mm; }
    .cover-corner.tr { top: 14mm; right: 14mm; transform: scaleX(-1); }
    .cover-corner.bl { bottom: 14mm; left: 14mm; transform: scaleY(-1); }
    .cover-corner.br { bottom: 14mm; right: 14mm; transform: scale(-1, -1); }
    .cover-corner svg { width: 100%; height: 100%; }

    .cover-inner {
      position: relative; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: space-between;
      padding: 42mm 28mm;
      text-align: center;
    }
    .cover-imprint {
      font-family: 'Inter', sans-serif;
      font-size: 9pt; letter-spacing: 8px;
      color: var(--gold-300); font-weight: 500;
      margin: 0;
    }

    .cover-plate {
      display: flex; flex-direction: column; align-items: center; gap: 6mm;
      max-width: 150mm;
    }
    .cover-title-ar {
      font-family: 'Aref Ruqaa', 'Amiri', serif;
      font-size: 88pt;
      color: #F5EAD2;
      margin: 0; line-height: 1.15; font-weight: 700;
      direction: rtl;
      text-shadow: 0 0 8mm rgba(212, 188, 147, 0.18);
    }
    .cover-ornament { width: 64mm; opacity: 0.85; line-height: 0; }
    .cover-ornament svg { width: 100%; height: auto; }
    .cover-title-id {
      font-family: 'Cormorant Garamond', serif;
      font-size: 30pt; font-weight: 600; font-style: italic;
      color: var(--gold-300); margin: 0; line-height: 1.2;
    }
    .cover-subtitle {
      font-family: 'EB Garamond', serif; font-style: italic;
      font-size: 12pt; color: #E8DCC2; margin: 0; max-width: 130mm;
    }

    .cover-byline {
      display: flex; flex-direction: column; align-items: center; gap: 1mm;
    }
    .cover-by-label {
      font-family: 'Inter', sans-serif;
      font-size: 8pt; letter-spacing: 4px; text-transform: uppercase;
      color: var(--gold-300); margin: 0;
    }
    .cover-author {
      font-family: 'Cormorant Garamond', serif;
      font-size: 20pt; font-weight: 600; color: #F5EAD2; margin: 0;
    }
    .cover-generator {
      font-family: 'EB Garamond', serif; font-style: italic;
      font-size: 11pt; color: #BFA974; margin: 0;
    }

    .cover-footer {
      width: 100%;
      display: flex; flex-direction: column; align-items: center; gap: 4mm;
    }
    .cover-rule {
      width: 50mm; height: 0.6pt;
      background: linear-gradient(90deg, transparent, var(--gold-300), transparent);
    }
    .cover-wordmark {
      display: flex; align-items: center; gap: 3mm;
      font-family: 'Inter', sans-serif;
      font-size: 9pt; letter-spacing: 3px; color: var(--gold-300);
    }
    .wm-ar { font-family: 'Aref Ruqaa', serif; font-size: 16pt; color: #F5EAD2; }
    .wm-lat { font-weight: 600; }
    .wm-dot { color: var(--gold-300); }
    .wm-year { font-style: italic; font-family: 'EB Garamond', serif; font-size: 10pt; letter-spacing: 1px; }

    /* ── Inside chapter pages ──────────────────────────────────── */
    .fig-page {
      page-break-before: always;
    }
    .fig-page:first-of-type { page-break-before: avoid; }

    .chapter-head {
      text-align: center;
      margin-bottom: 10mm;
      padding-bottom: 6mm;
      position: relative;
    }
    .chapter-head::after {
      content: ""; position: absolute;
      bottom: 0; left: 50%; transform: translateX(-50%);
      width: 80mm; height: 0.6pt;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
    }
    .chapter-meta {
      font-family: 'Inter', sans-serif;
      font-size: 8pt; letter-spacing: 5px; text-transform: uppercase;
      color: var(--gold-700); margin-bottom: 4mm;
    }
    .chapter-meta .chapter-no { font-weight: 700; }
    .chapter-meta .chapter-of { color: var(--ink-300); margin-left: 2mm; }
    .chapter-titles { display: flex; flex-direction: column; align-items: center; gap: 3mm; }
    .fig-name-ar {
      font-family: 'Aref Ruqaa', 'Amiri', serif;
      font-size: 38pt; color: var(--emerald-700); margin: 0;
      line-height: 1.2; font-weight: 700; direction: rtl;
    }
    .fig-name-id {
      font-family: 'Cormorant Garamond', serif;
      font-size: 20pt; color: var(--ink-700); margin: 0;
      font-style: italic; font-weight: 600;
    }
    .chapter-ornament { width: 44mm; opacity: 0.85; line-height: 0; color: var(--ornament); }
    .chapter-ornament svg { width: 100%; height: auto; }

    .pull-quote {
      margin: 6mm 14mm 10mm;
      text-align: center;
      padding: 4mm 2mm; position: relative;
    }
    .pull-quote::before, .pull-quote::after {
      content: ""; display: block; height: 0.6pt; margin: 0 auto;
      width: 60mm;
      background: linear-gradient(90deg, transparent, var(--gold-300), transparent);
    }
    .pull-quote::before { margin-bottom: 3mm; }
    .pull-quote::after { margin-top: 3mm; }
    .pull-quote .pq-ar {
      font-family: 'Aref Ruqaa', serif; font-size: 18pt;
      color: var(--emerald-primary); margin: 0 0 2mm; line-height: 1.5;
    }
    .pull-quote .pq-id {
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 13pt; color: var(--ink-700); margin: 0;
    }

    .chapter-body {
      display: grid;
      grid-template-columns: 1fr 56mm;
      gap: 9mm;
    }
    .sidebar-callout {
      grid-column: 2;
      padding: 5mm;
      background: linear-gradient(180deg, #FBF8F0 0%, #F2EBD9 100%);
      border-top: 1pt solid var(--emerald-700);
      border-bottom: 1pt solid var(--gold);
      font-size: 8.5pt;
      color: var(--ink-700);
      height: fit-content;
    }
    .sidebar-callout h4 {
      font-family: 'Cormorant Garamond', serif;
      font-style: italic; font-weight: 600;
      font-size: 12pt; margin: 0 0 3mm;
      color: var(--emerald-700);
      text-align: center;
    }
    .sidebar-callout dl { margin: 0; }
    .sidebar-callout dt {
      font-family: 'Inter', sans-serif;
      font-size: 7pt; letter-spacing: 2px; text-transform: uppercase;
      color: var(--gold-700); margin-top: 2mm;
    }
    .sidebar-callout dd { margin: 0 0 1mm; font-weight: 500; }

    .fig-body-text { grid-column: 1; }
    .fig-bio {
      font-family: 'EB Garamond', serif;
      font-size: 11.5pt; line-height: 1.7;
      color: var(--ink-900);
      text-align: justify; hyphens: auto;
    }
    .fig-bio p { margin: 0 0 3mm; text-indent: 4mm; }
    .fig-bio p.first-para { text-indent: 0; }
    .fig-bio p.first-para::first-letter {
      font-family: 'Aref Ruqaa', 'Cormorant Garamond', serif;
      font-size: 64pt; float: left; line-height: 0.8;
      padding: 2mm 3mm 0 0; color: var(--emerald-700); font-weight: 700;
    }
    .cite-ref {
      font-size: 7pt; color: var(--gold-700);
      vertical-align: super; line-height: 0; font-weight: 700;
    }
    .fig-bio-ar {
      font-family: 'Amiri', 'Aref Ruqaa', serif;
      font-size: 14.5pt; line-height: 2;
      direction: rtl; text-align: justify;
      margin-top: 8mm; padding-top: 5mm;
      border-top: 0.4pt solid var(--gold-300);
      position: relative;
    }
    .fig-bio-ar::before {
      content: ""; position: absolute;
      top: -1pt; left: 50%; transform: translateX(-50%);
      width: 30mm; height: 0.6pt;
      background: linear-gradient(90deg, transparent, var(--gold), transparent);
    }
    .fig-bio-ar p { margin: 0 0 2mm; }

    .fig-meta-line {
      margin-top: 8mm; padding: 4mm 0;
      border-top: 0.4pt solid var(--gold-300);
      border-bottom: 0.4pt solid var(--gold-300);
      display: flex; flex-wrap: wrap; gap: 6mm; justify-content: center;
      font-family: 'Cormorant Garamond', serif;
      font-style: italic; font-size: 10pt; color: var(--ink-500);
    }
    .fig-meta-line b {
      color: var(--emerald-700); font-weight: 700; font-style: normal;
      font-family: 'Inter', sans-serif;
      font-size: 7pt; letter-spacing: 2px; text-transform: uppercase;
      margin-right: 2mm;
    }

    .timeline {
      margin: 8mm 0; padding: 4mm;
      border-top: 0.4pt solid var(--gold-300);
      border-bottom: 0.4pt solid var(--gold-300);
    }
    .timeline h4 {
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 11pt; margin: 0 0 2mm; color: var(--emerald-700);
      text-align: center;
    }

    .map-placeholder {
      margin: 8mm 0; padding: 6mm; text-align: center;
      background: linear-gradient(180deg, var(--cream-200), var(--cream-300));
      border: 0.4pt solid var(--gold-300);
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 11pt; color: var(--emerald-700);
    }
    .map-placeholder .map-hint {
      font-family: 'Inter', sans-serif; font-style: normal;
      font-size: 7pt; color: var(--ink-500); margin-top: 1mm;
    }

    .footnotes {
      margin-top: 10mm; padding-top: 4mm;
      border-top: 0.4pt solid var(--gold-300);
      font-family: 'EB Garamond', serif;
      font-size: 9pt; color: var(--ink-700);
      column-count: 2; column-gap: 8mm;
    }
    .footnotes h4 {
      column-span: all;
      font-family: 'Cormorant Garamond', serif; font-style: italic;
      font-size: 11pt; margin: 0 0 3mm; color: var(--emerald-700);
      text-align: center;
    }
    .footnotes ol { margin: 0; padding-left: 4mm; }
    .footnotes li { margin-bottom: 1.5mm; break-inside: avoid; }
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
