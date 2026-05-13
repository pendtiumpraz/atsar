// "Minimalist" PDF template — maximum whitespace, hairline rules,
// monochrome plus a single emerald accent. Designed for readers who
// want the content to breathe.
//
// Visual identity:
//   - Inter at low contrast for body, Playfair Display for titles.
//   - Amiri for Arabic (kept smaller than the calligraphy template).
//   - Hairline rules and tiny labels (8pt uppercase) for structure.
//   - No drop caps, no ornaments, no fills — just typography.

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
      <p class="cover-tag">Atsar &middot; Sirah PDF</p>
      <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
      ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
      <div class="cover-rule"></div>
      <div class="cover-meta">
        <span>${escapeHtml(authorName)}</span>
        <span class="dim">${escapeHtml(authorEmail)}</span>
      </div>
      <footer class="cover-footer">athar.id</footer>
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
  ${fontImports()}
  <style>
    ${paletteCss()}
    @page { size: auto; margin: 22mm 22mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', system-ui, sans-serif;
      color: var(--ink-700);
      background: #fff;
      font-weight: 300;
    }
    .page { page-break-after: always; padding: 4mm 0; position: relative; }
    .page:last-child { page-break-after: auto; }

    /* Cover */
    .cover { min-height: 92vh; display: flex; flex-direction: column; justify-content: flex-end; padding: 20mm 8mm; page-break-after: always; position: relative; }
    .cover-tag { font-size: 8pt; letter-spacing: 4px; text-transform: uppercase; color: var(--ink-300); margin: 0 0 auto; }
    .cover-title-ar { font-family: 'Amiri', serif; font-size: 52pt; color: var(--ink-900); margin: 0 0 6mm 0; line-height: 1.2; font-weight: 700; }
    .cover-title-id { font-family: 'Playfair Display', serif; font-size: 15pt; color: var(--ink-500); font-weight: 400; margin: 0 0 12mm; font-style: italic; }
    .cover-rule { width: 100%; height: 1px; background: var(--emerald-primary); margin: 6mm 0; }
    .cover-meta { display: flex; justify-content: space-between; font-size: 9pt; color: var(--ink-700); padding-top: 2mm; }
    .cover-meta .dim { color: var(--ink-300); }
    .cover-footer { margin-top: 14mm; font-size: 7pt; color: var(--ink-300); letter-spacing: 3px; text-transform: uppercase; }

    /* Figure pages */
    .fig-page--minimalist { padding: 8mm 4mm; }
    .fig-page--minimalist .fig-name-ar { font-family: 'Amiri', serif; font-size: 24pt; color: var(--ink-900); margin: 0 0 2mm; direction: rtl; text-align: right; font-weight: 700; }
    .fig-page--minimalist .fig-name-id { font-family: 'Playfair Display', serif; font-size: 13pt; color: var(--ink-500); margin: 0 0 4mm; font-style: italic; font-weight: 400; }
    .fig-page--minimalist .fig-meta { display: flex; gap: 12mm; font-size: 8pt; color: var(--ink-500); margin: 8mm 0; padding-top: 2mm; border-top: 1px solid var(--cream-300); text-transform: uppercase; letter-spacing: 1.5px; }
    .fig-page--minimalist .fig-meta b { color: var(--emerald-primary); font-weight: 600; }
    .fig-page--minimalist .fig-bio { font-family: 'Inter', sans-serif; font-size: 10pt; line-height: 1.7; color: var(--ink-700); font-weight: 300; }
    .fig-page--minimalist .fig-bio p { margin: 0 0 4mm; }
    .fig-page--minimalist .fig-bio-ar { font-family: 'Amiri', serif; font-size: 12pt; line-height: 1.95; direction: rtl; text-align: right; margin-top: 8mm; padding-top: 4mm; border-top: 1px solid var(--cream-300); font-weight: 400; }

    .timeline { margin: 8mm 0; padding: 0; }
    .timeline h4 { font-family: 'Inter', sans-serif; font-size: 7pt; margin: 0 0 2mm; color: var(--ink-300); text-transform: uppercase; letter-spacing: 3px; font-weight: 400; }

    .map-placeholder { margin: 6mm 0; padding: 4mm 0; border-top: 1px solid var(--cream-300); font-size: 8pt; color: var(--ink-500); }

    .watermark { position: fixed; bottom: 10mm; right: 8mm; font-family: 'Inter', sans-serif; font-size: 6pt; color: var(--ink-300); letter-spacing: 4px; text-transform: uppercase; opacity: 0.6; }
  </style>
</head>
<body>
  ${cover}
  ${pages}
  ${watermark()}
</body>
</html>`
}
