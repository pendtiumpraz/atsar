// "Mahasiswa" (study edition) PDF template — public slug remains `minimalist`.
//
// Visual identity: notebook-style off-white paper (#FDFCF8) with a faint
// horizontal rule grid, oversized outer margin for handwritten notes,
// Scheherazade New Arabic + Inter Latin, and callout boxes for key
// teachers / dates / definitions. The cover keeps a study-hall tone:
// a stamp-style title block with the bab count and the year.

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

  // Soft star pattern used as a thin top band on the cover.
  const starPattern = islamicStarPattern('#0F4C3A', 0.10)
  const yearStamp = dualYearStamp()

  const cover = `
    <section class="cover">
      ${coverImageUrl ? `<div class="cover-photo" style="background-image:url('${escapeHtml(coverImageUrl)}')"></div>` : ''}
      <div class="cover-pattern-band"></div>

      <div class="cover-inner">
        <header class="cover-stamp">
          <div class="stamp-corner tl"></div>
          <div class="stamp-corner tr"></div>
          <div class="stamp-corner bl"></div>
          <div class="stamp-corner br"></div>
          <p class="cover-imprint">Atsar &middot; Edisi Mahasiswa</p>
          <p class="cover-stamp-tag">Cetakan Pelajar &middot; ${yearStamp}</p>
        </header>

        <div class="cover-titles">
          <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
          ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
          ${subtitleId ? `<p class="cover-subtitle">${escapeHtml(subtitleId)}</p>` : ''}
        </div>

        <div class="cover-fields">
          <div class="field">
            <span class="field-label">Disusun oleh</span>
            <span class="field-value">${escapeHtml(authorName)}</span>
            <span class="field-rule"></span>
          </div>
          <div class="field">
            <span class="field-label">Kelas / Halaqah</span>
            <span class="field-rule"></span>
          </div>
          <div class="field">
            <span class="field-label">Catatan</span>
            <span class="field-rule"></span>
            <span class="field-rule"></span>
          </div>
        </div>

        <footer class="cover-footer">
          <div class="cover-mini-meta">
            <span class="mini-num">${String(figures.length).padStart(2, '0')}</span>
            <span class="mini-label">Bab biografi</span>
          </div>
          <div class="cover-wordmark">
            <span class="wm-ar" lang="ar" dir="rtl">أَثَر</span>
            <span class="wm-lat">ATSAR · BOOK GENERATOR</span>
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
        style: 'minimalist',
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
    'Scheherazade+New:wght@400;700',
    'Amiri:wght@400;700',
    'Inter:wght@300;400;500;600;700',
  ])}
  <style>
    ${paletteCss()}

    /* Study edition uses an oversized outer margin (40mm) to leave room
       for handwritten annotation. Inner margin stays at 22mm for spine
       binding. */
    @page { size: A4; margin: 28mm 40mm 28mm 22mm; }
    @page :first { margin: 0; }
    @page :left  { margin: 28mm 22mm 28mm 40mm;
                   @bottom-left  { content: counter(page); font-family: 'Inter', sans-serif; font-size: 8pt; color: #6B5E4D; }
                   @top-left     { content: "${escapeCssString((titleId ?? titleAr ?? 'Atsar').toUpperCase())}"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 3px; color: #A89A85; } }
    @page :right { margin: 28mm 40mm 28mm 22mm;
                   @bottom-right { content: counter(page); font-family: 'Inter', sans-serif; font-size: 8pt; color: #6B5E4D; }
                   @top-right    { content: "ATSAR · EDISI MAHASISWA"; font-family: 'Inter', sans-serif; font-size: 7pt; letter-spacing: 3px; color: #A89A85; } }

    :root {
      --paper: #FDFCF8;
      --rule-line: #E9E2D0;
      --ornament: #0F4C3A;
    }

    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', system-ui, sans-serif;
      color: var(--ink-700);
      background: var(--paper);
      font-weight: 400;
    }

    /* ── Cover ─────────────────────────────────────────────────── */
    .cover {
      position: relative;
      width: 210mm; height: 297mm;
      background: var(--paper);
      page-break-after: always;
      overflow: hidden;
    }
    .cover-photo {
      position: absolute; inset: 0;
      background-size: cover; background-position: center;
      opacity: 0.08;
    }
    .cover-pattern-band {
      position: absolute; top: 0; left: 0; right: 0; height: 20mm;
      background-image: ${starPattern};
      background-size: 20mm 20mm;
      opacity: 0.7;
      border-bottom: 0.4pt solid var(--emerald-primary);
    }
    .cover-inner {
      position: relative;
      height: 100%;
      padding: 36mm 22mm 22mm;
      display: grid;
      grid-template-rows: auto 1fr auto auto;
      gap: 12mm;
    }

    .cover-stamp {
      position: relative;
      align-self: start;
      justify-self: start;
      padding: 4mm 6mm;
      border: 0.8pt solid var(--emerald-primary);
    }
    .stamp-corner {
      position: absolute; width: 2mm; height: 2mm; background: var(--emerald-primary);
    }
    .stamp-corner.tl { top: -1mm; left: -1mm; }
    .stamp-corner.tr { top: -1mm; right: -1mm; }
    .stamp-corner.bl { bottom: -1mm; left: -1mm; }
    .stamp-corner.br { bottom: -1mm; right: -1mm; }
    .cover-imprint {
      font-size: 8pt; letter-spacing: 4px; text-transform: uppercase;
      color: var(--emerald-primary); font-weight: 700;
      margin: 0 0 1mm;
    }
    .cover-stamp-tag {
      font-size: 7pt; letter-spacing: 2px;
      color: var(--ink-500); margin: 0;
    }

    .cover-titles { align-self: end; max-width: 150mm; }
    .cover-title-ar {
      font-family: 'Scheherazade New', 'Amiri', serif;
      font-size: 72pt;
      color: var(--ink-900);
      margin: 0 0 4mm;
      line-height: 1.1;
      font-weight: 700;
      direction: rtl;
    }
    .cover-title-id {
      font-family: 'Inter', sans-serif;
      font-size: 24pt;
      color: var(--emerald-primary);
      margin: 0;
      font-weight: 600;
      line-height: 1.2;
      max-width: 140mm;
    }
    .cover-subtitle {
      font-family: 'Inter', sans-serif; font-style: italic;
      font-size: 11pt; color: var(--ink-500);
      margin: 3mm 0 0; max-width: 130mm;
    }

    .cover-fields {
      display: flex; flex-direction: column; gap: 4mm;
      max-width: 130mm;
    }
    .field {
      display: flex; flex-direction: column; gap: 1mm;
    }
    .field-label {
      font-size: 7pt; letter-spacing: 2px; text-transform: uppercase;
      color: var(--ink-300);
    }
    .field-value {
      font-size: 11pt; color: var(--ink-900); font-weight: 500;
    }
    .field-rule {
      display: block; height: 0.4pt; background: var(--rule-line);
    }

    .cover-footer {
      display: flex; justify-content: space-between; align-items: flex-end;
      padding-top: 4mm; border-top: 0.4pt solid var(--rule-line);
    }
    .cover-mini-meta { display: flex; flex-direction: column; align-items: flex-start; }
    .mini-num {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 36pt; line-height: 1; color: var(--emerald-primary);
    }
    .mini-label {
      font-size: 7pt; letter-spacing: 3px; text-transform: uppercase;
      color: var(--ink-300); margin-top: 1mm;
    }
    .cover-wordmark { display: flex; flex-direction: column; align-items: flex-end; gap: 1mm; }
    .wm-ar { font-family: 'Amiri', serif; font-size: 20pt; color: var(--emerald-primary); }
    .wm-lat { font-size: 7pt; letter-spacing: 4px; color: var(--ink-500); }

    /* ── Inside chapter pages ──────────────────────────────────── */
    .fig-page {
      page-break-before: always;
      /* Faint horizontal rule lines, like a study notebook. The line
         height (8mm) matches the body line-height so the text rides
         the rules cleanly. */
      background-image: linear-gradient(var(--rule-line) 0.3pt, transparent 0.3pt);
      background-size: 100% 8mm;
      background-position: 0 6mm;
    }
    .fig-page:first-of-type { page-break-before: avoid; }

    .chapter-head {
      margin-bottom: 8mm; padding-bottom: 4mm;
      border-bottom: 0.6pt solid var(--emerald-primary);
    }
    .chapter-meta {
      font-size: 7pt; letter-spacing: 3px; text-transform: uppercase;
      color: var(--emerald-primary); font-weight: 700;
      margin-bottom: 3mm;
      display: flex; gap: 2mm; align-items: baseline;
    }
    .chapter-meta .chapter-of { color: var(--ink-300); font-weight: 400; }
    .chapter-titles { display: flex; flex-direction: column; gap: 2mm; }
    .fig-name-ar {
      font-family: 'Scheherazade New', 'Amiri', serif;
      font-size: 28pt; color: var(--ink-900); margin: 0;
      line-height: 1.2; font-weight: 700; direction: rtl; text-align: right;
    }
    .fig-name-id {
      font-family: 'Inter', sans-serif;
      font-size: 15pt; color: var(--emerald-primary); margin: 0;
      font-weight: 600;
    }
    .chapter-ornament { width: 24mm; opacity: 0.5; line-height: 0; color: var(--ornament); }
    .chapter-ornament svg { width: 100%; height: auto; }

    .pull-quote {
      margin: 6mm 0;
      padding: 4mm 6mm;
      background: #FAF6E6;
      border: 0.4pt dashed var(--gold);
      border-radius: 1mm;
      position: relative;
    }
    .pull-quote::before {
      content: "Ucapan beliau"; position: absolute;
      top: -2mm; left: 4mm; padding: 0 2mm; background: var(--paper);
      font-size: 7pt; letter-spacing: 2px; text-transform: uppercase;
      color: var(--gold-700); font-weight: 600;
    }
    .pull-quote .pq-ar {
      font-family: 'Scheherazade New', 'Amiri', serif;
      font-size: 15pt; color: var(--emerald-primary);
      margin: 0 0 2mm; line-height: 1.5;
    }
    .pull-quote .pq-id {
      font-family: 'Inter', sans-serif; font-style: italic;
      font-size: 10pt; color: var(--ink-700); margin: 0;
    }

    .chapter-body { display: block; }
    .sidebar-callout {
      float: right;
      width: 52mm;
      margin: 0 0 4mm 6mm;
      padding: 4mm;
      background: #FFFFFF;
      border-left: 2pt solid var(--emerald-primary);
      font-size: 8.5pt;
      color: var(--ink-700);
      box-shadow: 0 0.4pt 0 var(--rule-line);
    }
    .sidebar-callout h4 {
      font-size: 7pt; letter-spacing: 2px; text-transform: uppercase;
      color: var(--emerald-primary); font-weight: 700;
      margin: 0 0 2mm;
    }
    .sidebar-callout dl { margin: 0; }
    .sidebar-callout dt {
      font-size: 7pt; letter-spacing: 1.5px; text-transform: uppercase;
      color: var(--ink-300); margin-top: 2mm;
    }
    .sidebar-callout dd { margin: 0; font-weight: 500; }

    .fig-bio {
      font-family: 'Inter', sans-serif;
      font-size: 10pt; line-height: 1.7; color: var(--ink-700); font-weight: 400;
      text-align: justify; hyphens: auto;
    }
    .fig-bio p { margin: 0 0 3mm; }
    .fig-bio p.first-para::first-letter {
      font-family: 'Inter', sans-serif; font-weight: 700;
      font-size: 32pt; float: left; line-height: 0.9;
      padding: 1mm 2mm 0 0; color: var(--emerald-primary);
    }
    .cite-ref {
      font-size: 7pt; color: var(--emerald-primary);
      vertical-align: super; line-height: 0; font-weight: 600;
    }
    .fig-bio-ar {
      font-family: 'Scheherazade New', 'Amiri', serif;
      font-size: 13pt; line-height: 1.9;
      direction: rtl; text-align: justify;
      margin-top: 6mm; padding-top: 4mm; clear: both;
      border-top: 0.4pt dashed var(--rule-line);
    }
    .fig-bio-ar p { margin: 0 0 2mm; }

    .fig-meta-line {
      clear: both;
      margin-top: 8mm; padding: 3mm 0;
      border-top: 0.6pt solid var(--emerald-primary);
      display: flex; flex-wrap: wrap; gap: 6mm;
      font-size: 8pt; color: var(--ink-500);
    }
    .fig-meta-line b {
      color: var(--emerald-primary); font-weight: 700;
      font-size: 7pt; letter-spacing: 1.5px; text-transform: uppercase;
      margin-right: 1.5mm;
    }

    .timeline { margin: 6mm 0; clear: both; }
    .timeline h4 {
      font-size: 7pt; margin: 0 0 2mm; color: var(--emerald-primary);
      text-transform: uppercase; letter-spacing: 3px; font-weight: 700;
    }

    .map-placeholder {
      margin: 6mm 0; padding: 4mm; clear: both;
      background: #FFFFFF; border: 0.6pt dashed var(--rule-line);
      font-size: 9pt; color: var(--ink-500);
    }
    .map-placeholder b { color: var(--emerald-primary); }
    .map-placeholder .map-hint { font-size: 7pt; color: var(--ink-300); margin-top: 1mm; }

    .footnotes {
      margin-top: 8mm; padding-top: 3mm; clear: both;
      border-top: 0.6pt solid var(--rule-line);
      font-size: 8.5pt; color: var(--ink-700);
    }
    .footnotes h4 {
      font-size: 7pt; margin: 0 0 2mm; color: var(--emerald-primary);
      text-transform: uppercase; letter-spacing: 3px; font-weight: 700;
    }
    .footnotes ol { margin: 0; padding-left: 4mm; }
    .footnotes li { margin-bottom: 1mm; }
    .footnotes sup { color: var(--emerald-primary); font-weight: 700; }
    .footnotes .src { color: var(--ink-300); font-style: italic; }
  </style>
</head>
<body>
  ${cover}
  ${pages}
</body>
</html>`
}
