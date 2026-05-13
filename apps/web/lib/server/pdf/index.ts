// Barrel re-export for `lib/server/pdf`.
// Import from `@/lib/server/pdf` rather than the individual modules.
//
// Exposes:
//   - PDF rendering (`generatePdfBuffer`).
//   - Template registry + types (`getTemplate`, `templateRegistry`,
//     `TemplateInput`, `FigureRich`, `LanguageMode`, `BuildFn`).

export { generatePdfBuffer } from './generate.js'
export type {
  PaperSize,
  Orientation,
  GeneratePdfInput,
} from './generate.js'

export {
  templateRegistry,
  getTemplate,
  listTemplateSlugs,
  escapeHtml,
  fontImports,
  paletteCss,
  renderFigurePage,
  renderTimeline,
  renderMapPlaceholder,
  watermark,
} from './templates/index.js'
export type {
  FigureRich,
  LanguageMode,
  TemplateInput,
  BuildFn,
} from './templates/index.js'
