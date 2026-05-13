// "Modern" PDF template — clean sans-serif, generous whitespace, accent
// gold rule. Inspired by contemporary editorial design (Monocle, Kinfolk).
//
// Visual identity:
//   - Inter for Latin body & headings.
//   - Cairo for Arabic (geometric sans, pairs well with Inter).
//   - Bold horizontal emerald rule + small gold ornament under each
//     figure name.
//   - Two-column meta block for dates / rijal / kunyah.

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
      <div class="cover-strip"></div>
      <h1 class="cover-title-ar" lang="ar" dir="rtl">${escapeHtml(titleAr ?? 'كتاب السيرة')}</h1>
      ${titleId ? `<h2 class="cover-title-id">${escapeHtml(titleId)}</h2>` : ''}
      <div class="cover-meta">
        <div>
          <span class="label">Penulis</span>
          <span class="value">${escapeHtml(authorName)}</span>
        </div>
        <div>
          <span class="label">Email</span>
          <span class="value">${escapeHtml(authorEmail)}</span>
        </div>
      </div>
      <footer class="cover-footer">
        <span>Dibuat oleh Athar</span>
        <span class="dot">&middot;</span>
        <span>athar.id</span>
      </footer>
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
  <title>${escapeHtml(titleId ?? titleAr ?? 'Athar — Sirah PDF')}</title>
  ${fontImports()}
  <style>
    ${paletteCss()}
    @page { size: auto; margin: 14mm 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; padding: 0;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: var(--ink-700);
      background: #fff;
    }
    .page { page-break-after: always; padding: 4mm 0; position: relative; }
    .page:last-child { page-break-after: auto; }

    /* Cover */
    .cover { min-height: 92vh; display: flex; flex-direction: column; justify-content: flex-start; padding: 16mm 12mm; page-break-after: always; position: relative; }
    .cover-strip { width: 32mm; height: 3mm; background: var(--emerald-primary); margin-bottom: 14mm; }
    .cover-title-ar { font-family: 'Cairo', sans-serif; font-size: 64pt; color: var(--emerald-primary); margin: 0 0 6mm 0; line-height: 1.1; font-weight: 700; }
    .cover-title-id { font-family: 'Inter', sans-serif; font-size: 18pt; color: var(--ink-500); font-weight: 400; margin: 0; max-width: 70%; }
    .cover-meta { margin-top: auto; padding-top: 30mm; display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .cover-meta .label { display: block; font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; color: var(--ink-300); margin-bottom: 1mm; }
    .cover-meta .value { font-size: 12pt; color: var(--ink-700); }
    .cover-footer { margin-top: 8mm; padding-top: 4mm; border-top: 1px solid var(--cream-300); font-size: 8pt; color: var(--ink-500); letter-spacing: 1px; }
    .cover-footer .dot { margin: 0 2mm; color: var(--gold); }

    /* Figure pages */
    .fig-page--modern { padding: 6mm 4mm; }
    .fig-page--modern .fig-name-ar { font-family: 'Cairo', sans-serif; font-size: 28pt; color: var(--emerald-primary); margin: 0 0 1mm; direction: rtl; text-align: left; font-weight: 700; }
    .fig-page--modern .fig-name-id { font-family: 'Inter', sans-serif; font-size: 14pt; color: var(--ink-500); font-weight: 400; margin: 0 0 4mm; }
    .fig-page--modern .fig-name-id::after { content: ''; display: block; width: 16mm; height: 2px; background: var(--gold); margin-top: 4mm; }
    .fig-page--modern .fig-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; font-size: 9pt; color: var(--ink-500); margin: 6mm 0; }
    .fig-page--modern .fig-meta b { display: block; font-size: 7pt; text-transform: uppercase; letter-spacing: 1.5px; color: var(--emerald-primary); font-weight: 600; margin-bottom: 1mm; }
    .fig-page--modern .fig-bio { font-family: 'Inter', sans-serif; font-size: 10.5pt; line-height: 1.65; color: var(--ink-700); }
    .fig-page--modern .fig-bio p { margin: 0 0 3mm; }
    .fig-page--modern .fig-bio-ar { font-family: 'Cairo', sans-serif; font-size: 12pt; line-height: 1.9; direction: rtl; text-align: right; margin-top: 6mm; padding-top: 4mm; border-top: 1px solid var(--cream-300); }

    .timeline { margin: 6mm 0; padding: 4mm 0; }
    .timeline h4 { font-family: 'Inter', sans-serif; font-size: 8pt; margin: 0 0 2mm; color: var(--emerald-primary); text-transform: uppercase; letter-spacing: 2px; }

    .map-placeholder { margin: 6mm 0; padding: 5mm; background: #fafafa; border: 1px solid var(--cream-300); font-size: 9pt; color: var(--ink-500); }

    .watermark { position: fixed; bottom: 6mm; right: 8mm; font-family: 'Inter', sans-serif; font-size: 7pt; color: var(--ink-300); letter-spacing: 3px; text-transform: uppercase; opacity: 0.5; }
  </style>
</head>
<body>
  ${cover}
  ${pages}
  ${watermark()}
</body>
</html>`
}
