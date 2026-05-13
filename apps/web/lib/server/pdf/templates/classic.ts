// "Classic" PDF template — serif-heavy, traditional book look.
//
// Visual identity:
//   - Body in Playfair Display (display serif), Inter for captions.
//   - Arabic in Amiri (Naskhi serif).
//   - Emerald Turats palette with gold accents (see BRANDING.md §4).
//   - Generous drop caps, ornamental rule between sections, ribbon
//     watermark at the corner of every page.

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
      <div class="cover-ornament top"></div>
      <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
      <p class="cover-rule">&#10086;</p>
      ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
      <div class="cover-spacer"></div>
      <p class="cover-author">${escapeHtml(authorName)}</p>
      <p class="cover-email">${escapeHtml(authorEmail)}</p>
      <div class="cover-ornament bottom"></div>
      <footer class="cover-footer">Dibuat oleh Atsar &middot; athar.id</footer>
    </section>
  `

  const pages = figures
    .map((figure, idx) =>
      renderFigurePage({
        figure,
        index: idx,
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
  ${fontImports()}
  <style>
    ${paletteCss()}
    @page { size: auto; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Playfair Display', Georgia, serif;
      color: var(--ink-700);
      background: var(--cream);
    }
    .page { page-break-after: always; padding: 4mm 0; position: relative; }
    .page:last-child { page-break-after: auto; }

    /* Cover */
    .cover { min-height: 90vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 12mm; page-break-after: always; }
    .cover-ornament { width: 70%; height: 6mm; background: linear-gradient(90deg, transparent, var(--gold) 40%, var(--gold) 60%, transparent); margin: 4mm 0; }
    .cover-title-ar { font-family: 'Amiri', serif; font-size: 56pt; color: var(--emerald-primary); margin: 0 0 4mm 0; line-height: 1.2; font-weight: 700; }
    .cover-title-id { font-family: 'Playfair Display', serif; font-size: 22pt; color: var(--ink-700); font-style: italic; margin: 0 0 8mm 0; }
    .cover-rule { color: var(--gold); font-size: 18pt; margin: 2mm 0 6mm; }
    .cover-spacer { flex: 1; min-height: 20mm; }
    .cover-author { font-size: 18pt; color: var(--emerald-primary); margin: 0; letter-spacing: 1px; }
    .cover-email { font-size: 10pt; color: var(--ink-500); margin: 2mm 0 0; }
    .cover-footer { position: absolute; bottom: 8mm; font-size: 9pt; color: var(--ink-500); width: 100%; left: 0; text-align: center; }

    /* Figure pages */
    .fig-page { padding: 8mm; position: relative; }
    .fig-page h2.fig-name-ar { font-family: 'Amiri', serif; font-size: 30pt; color: var(--emerald-primary); text-align: right; margin: 0 0 2mm; direction: rtl; }
    .fig-page h3.fig-name-id { font-family: 'Playfair Display', serif; font-size: 18pt; color: var(--ink-700); margin: 0 0 6mm; font-style: italic; }
    .fig-page .fig-meta { display: flex; gap: 12mm; font-family: 'Inter', sans-serif; font-size: 10pt; color: var(--ink-500); margin-bottom: 6mm; border-top: 1px solid var(--gold-300); border-bottom: 1px solid var(--gold-300); padding: 2mm 0; }
    .fig-page .fig-meta b { color: var(--emerald-primary); font-weight: 600; }
    .fig-page .fig-bio { font-family: 'Playfair Display', serif; font-size: 11pt; line-height: 1.7; text-align: justify; }
    .fig-page .fig-bio p:first-of-type::first-letter { font-size: 36pt; float: left; line-height: 1; padding-right: 3mm; color: var(--emerald-primary); font-weight: 700; }
    .fig-page .fig-bio-ar { font-family: 'Amiri', serif; font-size: 13pt; line-height: 2; direction: rtl; text-align: right; margin-top: 6mm; padding-top: 4mm; border-top: 1px dashed var(--gold-300); }

    .timeline { margin: 6mm 0; padding: 4mm; background: var(--cream-200); border-left: 3px solid var(--gold); }
    .timeline h4 { font-family: 'Inter', sans-serif; font-size: 10pt; margin: 0 0 2mm; color: var(--emerald-primary); text-transform: uppercase; letter-spacing: 1px; }

    .map-placeholder { margin: 6mm 0; padding: 6mm; text-align: center; background: var(--emerald-100); border-radius: 2mm; font-family: 'Inter', sans-serif; font-size: 10pt; color: var(--emerald-primary); }

    ${watermarkCss('classic')}
  </style>
</head>
<body>
  ${cover}
  ${pages}
  ${watermark()}
</body>
</html>`
}

function watermarkCss(_style: 'classic'): string {
  return `
    .watermark { position: fixed; bottom: 6mm; right: 8mm; font-family: 'Inter', sans-serif; font-size: 8pt; color: var(--ink-300); letter-spacing: 2px; transform: rotate(-2deg); opacity: 0.6; }
  `
}
