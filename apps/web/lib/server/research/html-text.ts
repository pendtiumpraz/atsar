// HTML → plain-text extractor for the research pipeline.
//
// Why this exists
// ---------------
// Raw HTML pages we fetch from salafi whitelist domains carry navbar +
// sidebar + footer + script + ads + comments — easily 60-80% of the
// page is non-content. The LLM only sees the first ~8 KB we hand it,
// so when that prefix is mostly nav/script, the AI extractor returns
// null biography and we lose the round-trip.
//
// This module turns a raw HTML string into compact readable text:
//   1. Drop `<script>` / `<style>` / `<noscript>` / `<iframe>` /
//      `<template>` blocks (the contents, not just the tags).
//   2. Drop site chrome blocks — `<nav>`, `<header>`, `<footer>`,
//      `<aside>`, plus anything with a class/role that screams nav.
//   3. Prefer `<article>` or `<main>` content when present (most
//      modern salafi sites use them for the biography body).
//   4. Convert structural tags (`<p>`, `<div>`, `<br>`, headings,
//      list items, table rows) to newlines so paragraph breaks
//      survive into the LLM prompt.
//   5. Strip remaining tags, decode common HTML entities, collapse
//      whitespace.
//
// Output is bounded by `maxChars` (default 12000) — about 3000-4000
// tokens, comfortably under the per-source slice the extractor uses.

const DROP_BLOCK_TAGS = ['script', 'style', 'noscript', 'iframe', 'template', 'svg']
const DROP_LAYOUT_TAGS = ['nav', 'header', 'footer', 'aside']

const ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number(dec)
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : ''
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => {
      const code = parseInt(hex, 16)
      return Number.isFinite(code) && code > 0 && code < 0x10ffff
        ? String.fromCodePoint(code)
        : ''
    })
    .replace(/&([a-zA-Z]+);/g, (whole, name: string) => ENTITY_MAP[name] ?? whole)
}

/**
 * Pull the biggest semantic-content block from the HTML so the LLM
 * doesn't have to fight through 30 KB of navigation to find a 2 KB
 * biography. Returns the original HTML if no <article>/<main> wrapper
 * is present.
 */
function isolateArticle(html: string): string {
  // Prefer <article>, fall back to <main>. Take the LONGEST match in
  // case the page has multiple article tags (e.g. related-posts strip).
  for (const tag of ['article', 'main'] as const) {
    const matches = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi'))]
    if (matches.length === 0) continue
    let best = ''
    for (const m of matches) {
      if (m[1] && m[1].length > best.length) best = m[1]
    }
    if (best.length > 0) return best
  }
  return html
}

/** Strip a set of full block tags + their contents. */
function dropBlockTags(html: string, tags: string[]): string {
  let out = html
  for (const tag of tags) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ')
  }
  return out
}

/**
 * Convert HTML to compact readable text. See module header for the
 * full pipeline. `maxChars` caps the final size (default 12000).
 */
export function htmlToText(html: string, maxChars = 12_000): string {
  if (!html || html.length === 0) return ''
  let text = html
  // 1. Drop blocks whose contents are pure noise.
  text = dropBlockTags(text, DROP_BLOCK_TAGS)
  // 2. Pick the article body if the page has one. Done BEFORE the
  //    layout-tag drop so we don't strip a `<nav>` that lives inside
  //    `<article>` (rare but breaks blogs with TOC sidebars).
  text = isolateArticle(text)
  // 3. Drop site chrome AFTER isolating.
  text = dropBlockTags(text, DROP_LAYOUT_TAGS)
  // 4. Newline-significant tags get a single \n before/after so the
  //    paragraph structure survives the tag strip.
  text = text
    .replace(/<\/?(p|div|section|article|main|li|tr|h[1-6]|blockquote|pre|br)\b[^>]*>/gi, '\n')
    .replace(/<\/?(ul|ol|table|tbody|thead|figure)\b[^>]*>/gi, '\n')
  // 5. Drop every other tag.
  text = text.replace(/<[^>]+>/g, ' ')
  // 6. Decode entities.
  text = decodeEntities(text)
  // 7. Normalise whitespace — keep newlines but collapse runs.
  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +| +$/gm, '')
    .trim()
  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd() + '\n…'
  }
  return text
}
