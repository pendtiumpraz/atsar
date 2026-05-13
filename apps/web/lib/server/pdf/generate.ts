// PDF generation core — HTML → PDF buffer via `puppeteer-core` +
// `@sparticuz/chromium`. The pairing of these two libs is the canonical
// way to run headless Chromium inside a Vercel serverless function: the
// upstream `puppeteer` package bundles Chromium itself (300+ MB → over the
// Vercel function size cap), whereas `puppeteer-core` skips the binary
// and `@sparticuz/chromium` ships a stripped-down Chromium tuned for AWS
// Lambda / Vercel.
//
// See docs/IDEAS.md §5b.7 (engine choice = Puppeteer).
// See vercel.json — this module is called from `/api/jobs/pdf` which has
// `maxDuration = 300` configured so cold-start + render fits the budget.

import chromium from '@sparticuz/chromium'
import puppeteer, { type Browser, type PaperFormat } from 'puppeteer-core'

/** Paper size, matching the `pdf_paper_size_enum` (`a5` | `a4` | `letter` | `legal`). */
export type PaperSize = 'a4' | 'a5' | 'letter' | 'legal'
/** Page orientation, matching the `pdf_orientation_enum`. */
export type Orientation = 'portrait' | 'landscape'

/** Input to {@link generatePdfBuffer}. */
export interface GeneratePdfInput {
  /** Full HTML document (must include `<html><head>…</head><body>…</body></html>`). */
  html: string
  /** Target paper size. */
  paperSize: PaperSize
  /** Target page orientation. */
  orientation: Orientation
}

/**
 * Normalise our lowercase enum value into the casing Puppeteer expects.
 * Puppeteer accepts `'A4' | 'A5' | 'Letter' | 'Legal' | …` for `page.pdf({ format })`.
 */
function toPuppeteerFormat(paperSize: PaperSize): PaperFormat {
  switch (paperSize) {
    case 'a4':
      return 'A4'
    case 'a5':
      return 'A5'
    case 'letter':
      return 'Letter'
    case 'legal':
      return 'Legal'
  }
}

/**
 * Render an HTML document into a PDF buffer.
 *
 * Always returns a `Buffer`, never a stream — the caller (job route) is
 * going to upload it to object storage in one go anyway, and keeping the
 * shape simple avoids stream-leak footguns inside the serverless function.
 *
 * The browser is closed in `finally` so a thrown render error still
 * releases the Chromium process — crucial on Vercel where a leaked process
 * holds the whole container hostage until the function times out.
 */
export async function generatePdfBuffer(input: GeneratePdfInput): Promise<Buffer> {
  const { html, paperSize, orientation } = input

  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })

    const page = await browser.newPage()

    // Note: puppeteer-core v24's `setContent` no longer accepts
    // `networkidle0` (the type is `Exclude<PuppeteerLifeCycleEvent,
    // 'networkidle0' | 'networkidle2'>`). We wait for `domcontentloaded`
    // first then explicitly wait for the network to settle — this is
    // important because the templates pull Google Fonts off the network
    // and we need fully-rendered glyphs (especially Arabic, which falls
    // back to ugly system fonts otherwise).
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15_000 })
    } catch {
      // Best-effort — if fonts hang past the timeout we'd rather print
      // with a fallback face than fail the whole job.
    }

    // Ensure print-media CSS rules apply (`@page` margins, page-break-*).
    await page.emulateMediaType('print')

    const pdf = await page.pdf({
      format: toPuppeteerFormat(paperSize),
      landscape: orientation === 'landscape',
      printBackground: true,
      // Margins match the templates' built-in `@page` CSS so the
      // template is the single source of truth for spacing.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    })

    // `page.pdf` returns `Uint8Array` in puppeteer v24 — wrap in Buffer
    // for nicer downstream ergonomics (length, upload helpers, etc.).
    return Buffer.from(pdf)
  } finally {
    if (browser) {
      // Defensive: closing the browser also closes pages; suppress any
      // teardown error so the original render error (if any) propagates.
      try {
        await browser.close()
      } catch (err) {
        console.warn('[pdf/generate] browser.close() failed', err)
      }
    }
  }
}
