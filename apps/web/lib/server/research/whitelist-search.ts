// Whitelist-domain search — given a figure name, return candidate URLs to crawl.
//
// Why this exists
// ---------------
// Per docs/IDEAS.md §4, the Deep Research pipeline must crawl ONLY from
// admin-managed whitelist domains (anti-hallucination guard). A real search
// step normally requires a Custom Search Engine (Google CSE) or DuckDuckGo
// API. Both require credentials that aren't provisioned yet.
//
// For v1 we ship a "naive" candidate-URL builder that probes a handful of
// well-known on-site search endpoints per domain. The downstream fetcher
// will hit those URLs; if a page returns useful HTML the extractor will use
// it, otherwise the fetcher will fail and the orchestrator moves on.
//
// TODO(v2): wire to Google CSE (or Brave Search / DuckDuckGo HTML scraping
// behind a proxy). The function signature and return shape don't need to
// change — only the implementation.

/** A whitelist row narrowed to the fields we actually use here. */
export interface WhitelistDomainRef {
  domain: string
  priority: number
}

/**
 * Known on-site search URL templates for the seed-whitelist domains called
 * out in docs/IDEAS.md §4. `{q}` is replaced with the URL-encoded query.
 *
 * Anything not in this map falls back to a generic `?s=<q>` (the WordPress
 * default) and `?q=<q>` probes — they'll often miss, which is fine, the
 * extractor will simply skip empty results.
 */
const KNOWN_SEARCH_TEMPLATES: Record<string, string[]> = {
  'dorar.net': ['https://dorar.net/search?q={q}'],
  'islamqa.info': ['https://islamqa.info/ar/search?query={q}'],
  'islamweb.net': ['https://www.islamweb.net/ar/search/?query={q}'],
  'sunnah.com': ['https://sunnah.com/search?q={q}'],
  'shamela.ws': ['https://shamela.ws/search?q={q}'],
  'alukah.net': ['https://www.alukah.net/search/?q={q}'],
}

/** Generic fallback probes for unknown domains. */
const FALLBACK_TEMPLATES = [
  'https://{domain}/?s={q}',
  'https://{domain}/search?q={q}',
  'https://{domain}/?q={q}',
]

const MAX_URLS_PER_DOMAIN = 2

/**
 * Build candidate crawl URLs for `figureName` across `domains`.
 *
 * Sort order: higher-priority whitelist domains first (matches admin intent),
 * then deterministic by domain alphabetical order so re-runs are stable.
 *
 * @param figureName - Arabic or transliterated figure name (e.g. "أبو بكر الصديق").
 * @param domains - Active whitelist domains (caller filters `is_active=true`).
 * @returns Up to ~2 URLs per domain, capped at 20 overall.
 */
export async function searchWhitelist(
  figureName: string,
  domains: WhitelistDomainRef[],
): Promise<string[]> {
  const query = encodeURIComponent(figureName.trim())
  if (!query || domains.length === 0) return []

  const sorted = [...domains].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    return a.domain.localeCompare(b.domain)
  })

  const urls: string[] = []
  for (const { domain } of sorted) {
    const templates = KNOWN_SEARCH_TEMPLATES[domain] ?? FALLBACK_TEMPLATES
    let added = 0
    for (const tpl of templates) {
      if (added >= MAX_URLS_PER_DOMAIN) break
      const url = tpl.replace('{q}', query).replace('{domain}', domain)
      urls.push(url)
      added += 1
    }
    if (urls.length >= 20) break
  }

  return urls
}
