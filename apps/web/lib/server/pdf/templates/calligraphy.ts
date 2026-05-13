// "Calligraphy" PDF template — Arabic showcase. Designed to feel like a
// kitab kuno opened on a velvet cushion: ornate, gold-heavy, Arabic
// dominant in size + position, Latin demoted to caption duty.
//
// Visual identity:
//   - Amiri (display weight) at huge sizes for Arabic.
//   - Playfair Display italic for Latin captions.
//   - Decorative ornamental frame around the cover title.
//   - Each figure page leads with a large Arabic name in a circular
//     calligraphy panel.

import type { TemplateInput } from './index.js'
import {
  escapeHtml,
  fontImports,
  paletteCss,
  renderFigurePage,
  renderTimeline,
  renderMapPlaceholder,
  watermark,
} from './index.js'

export function buildHtml(input: TemplateInput): string {
  const {
    titleAr,
    titleId,
    authorName,
    authorEmail,
    figures,
    languageMode,
    includeIllustrations,
    includeMaps,
    includeTimeline,
  } = input

  const cover = `
    <section class="cover">
      <div class="frame">
        <div class="corner tl"></div>
        <div class="corner tr"></div>
        <div class="corner bl"></div>
        <div class="corner br"></div>
        <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
        <p class="cover-ornament">&#10086; &nbsp; &#10042; &nbsp; &#10086;</p>
        ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
      </div>
      <div class="cover-author-block">
        <p class="cover-author">${escapeHtml(authorName)}</p>
        <p class="cover-email">${escapeHtml(authorEmail)}</p>
      </div>
      <footer class="cover-footer">Dibuat oleh Atsar &middot; athar.id</footer>
    </section>
  `

  const pages = figures
    .map((figure, idx) => {
      const baseSection = renderFigurePage({
        figure,
        index: idx,
        languageMode,
        includeIllustrations,
        includeMaps,
        includeTimeline,
        style: 'calligraphy',
        renderTimeline,
        renderMapPlaceholder,
      })
      // Prepend a decorative Arabic showcase panel. The "illustration"
      // flag toggles this since it's the heaviest non-essential visual.
      if (!includeIllustrations) return baseSection
      return `
        <section class="page panel-page">
          <div class="circle-panel">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="100%" preserveAspectRatio="xMidYMid meet">
              <defs>
                <radialGradient id="g${idx}" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stop-color="#FAF5EB" />
                  <stop offset="100%" stop-color="#E8DFC8" />
                </radialGradient>
              </defs>
              <circle cx="100" cy="100" r="96" fill="url(#g${idx})" stroke="#B89968" stroke-width="2" />
              <circle cx="100" cy="100" r="88" fill="none" stroke="#0F4C3A" stroke-width="0.5" stroke-dasharray="2 3" />
            </svg>
            <div class="circle-name" lang="ar" dir="rtl">${escapeHtml(figure.nameShortAr ?? figure.nameFullAr)}</div>
          </div>
          <p class="panel-caption">${escapeHtml(figure.nameFullId)}</p>
        </section>
        ${baseSection}
      `
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titleId ?? titleAr ?? 'Atsar — Sirah PDF')}</title>
  ${fontImports()}
  <style>
    ${paletteCss()}
    @page { size: auto; margin: 18mm 18mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Amiri', 'Playfair Display', serif;
      color: var(--ink-700);
      background: var(--cream);
    }
    .page { page-break-after: always; padding: 4mm 0; position: relative; }
    .page:last-child { page-break-after: auto; }

    /* Cover */
    .cover { min-height: 92vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 8mm; page-break-after: always; position: relative; }
    .frame { position: relative; padding: 18mm 12mm; border: 1px double var(--gold); margin-bottom: 14mm; max-width: 80%; }
    .corner { position: absolute; width: 12mm; height: 12mm; border: 2px solid var(--gold); }
    .corner.tl { top: -3mm; left: -3mm; border-right: none; border-bottom: none; }
    .corner.tr { top: -3mm; right: -3mm; border-left: none; border-bottom: none; }
    .corner.bl { bottom: -3mm; left: -3mm; border-right: none; border-top: none; }
    .corner.br { bottom: -3mm; right: -3mm; border-left: none; border-top: none; }
    .cover-title-ar { font-family: 'Amiri', serif; font-size: 72pt; color: var(--emerald-primary); margin: 0; line-height: 1.15; font-weight: 700; }
    .cover-ornament { color: var(--gold); font-size: 16pt; margin: 6mm 0; letter-spacing: 4px; }
    .cover-title-id { font-family: 'Playfair Display', serif; font-size: 16pt; color: var(--ink-700); font-style: italic; margin: 0; font-weight: 400; }
    .cover-author-block { margin-top: 8mm; }
    .cover-author { font-family: 'Amiri', serif; font-size: 20pt; color: var(--emerald-primary); margin: 0; }
    .cover-email { font-size: 9pt; color: var(--ink-500); margin: 2mm 0 0; font-family: 'Inter', sans-serif; }
    .cover-footer { position: absolute; bottom: 8mm; font-size: 9pt; color: var(--gold-700); font-family: 'Playfair Display', serif; font-style: italic; width: 100%; left: 0; text-align: center; }

    /* Calligraphy panel page */
    .panel-page { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 18mm; }
    .circle-panel { position: relative; width: 110mm; height: 110mm; }
    .circle-panel svg { width: 100%; height: 100%; display: block; }
    .circle-name { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Amiri', serif; font-size: 48pt; color: var(--emerald-primary); font-weight: 700; }
    .panel-caption { margin-top: 6mm; font-family: 'Playfair Display', serif; font-style: italic; font-size: 14pt; color: var(--ink-500); }

    /* Figure pages */
    .fig-page--calligraphy { padding: 8mm; }
    .fig-page--calligraphy .fig-name-ar { font-family: 'Amiri', serif; font-size: 36pt; color: var(--emerald-primary); text-align: center; margin: 0 0 3mm; direction: rtl; font-weight: 700; }
    .fig-page--calligraphy .fig-name-id { font-family: 'Playfair Display', serif; font-size: 14pt; color: var(--gold-700); text-align: center; font-style: italic; margin: 0 0 8mm; font-weight: 400; }
    .fig-page--calligraphy .fig-meta { display: flex; justify-content: center; gap: 8mm; font-family: 'Playfair Display', serif; font-style: italic; font-size: 10pt; color: var(--ink-500); margin-bottom: 8mm; padding: 3mm 0; border-top: 1px solid var(--gold-300); border-bottom: 1px solid var(--gold-300); }
    .fig-page--calligraphy .fig-meta b { color: var(--emerald-primary); font-weight: 700; font-style: normal; }
    .fig-page--calligraphy .fig-bio { font-family: 'Playfair Display', serif; font-size: 11pt; line-height: 1.75; text-align: justify; column-count: 1; }
    .fig-page--calligraphy .fig-bio-ar { font-family: 'Amiri', serif; font-size: 14pt; line-height: 2.1; direction: rtl; text-align: right; margin-top: 6mm; padding: 4mm 0; border-top: 1px dashed var(--gold-300); border-bottom: 1px dashed var(--gold-300); }

    .timeline { margin: 6mm 0; padding: 4mm; border-top: 1px solid var(--gold-300); border-bottom: 1px solid var(--gold-300); }
    .timeline h4 { font-family: 'Playfair Display', serif; font-style: italic; font-size: 10pt; margin: 0 0 2mm; color: var(--emerald-primary); text-align: center; }

    .map-placeholder { margin: 6mm 0; padding: 6mm; text-align: center; background: var(--cream-200); border: 1px solid var(--gold-300); font-family: 'Playfair Display', serif; font-style: italic; font-size: 10pt; color: var(--emerald-primary); }

    .watermark { position: fixed; bottom: 6mm; right: 8mm; font-family: 'Amiri', serif; font-size: 8pt; color: var(--gold-700); letter-spacing: 1px; opacity: 0.7; }
  </style>
</head>
<body>
  ${cover}
  ${pages}
  ${watermark()}
</body>
</html>`
}
