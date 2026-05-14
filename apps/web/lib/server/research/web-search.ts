// Free web search via DuckDuckGo HTML — no API key required.
//
// Why this exists
// ---------------
// `whitelist-search.ts` only builds candidate URLs by hitting each whitelist
// domain's *on-site search page*, which usually returns a search-result HTML
// (nav + sidebar + link list) instead of the actual biography article. The
// extractor then sees nothing useful and returns all-null.
//
// This module hits DuckDuckGo's HTML endpoint (`html.duckduckgo.com/html/`) —
// which aggregates Google/Bing/Yandex — with a salaf-biased query and returns
// the top result URLs (real article URLs, not search pages). Used as a
// fallback when the whitelist-search path can't yield enough content.
//
// No API key. DDG occasionally rate-limits or returns a captcha; in that case
// we return an empty list and the caller surfaces a soft failure.

const DDG_BASE = 'https://html.duckduckgo.com/html/'

// Browsers DDG accepts without challenging. Picking a desktop UA is more
// likely to return the standard HTML layout than the mobile one.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const DEFAULT_TIMEOUT_MS = 12_000

export interface WebSearchOptions {
  /** Max URLs to return. Default 10. */
  limit?: number
  /** Override the salaf-bias suffix appended to the query. */
  suffix?: string
  /** Hard ceiling on request, default 12s. */
  timeoutMs?: number
}

export interface WebSearchWithinDomainsOptions {
  /** Max URLs to return. Default 10. */
  limit?: number
  /** Hard ceiling on request, default 12s. */
  timeoutMs?: number
  /**
   * Cap how many `site:` operators DDG receives in one query. DDG honours
   * a handful, but long disjunctions degrade match quality. Default 6.
   */
  maxDomains?: number
}

/**
 * Run a websearch via DuckDuckGo HTML and return the top result URLs.
 *
 * The query is augmented with a salaf-bias suffix so results are weighted
 * toward salafi-leaning biographies (almanhaj, muslim.or.id, rumaysho,
 * dorar, binbaz, etc.) even when no whitelist filter is applied.
 *
 * Returns an empty array on any failure (DDG captcha, network, parse) —
 * callers should treat as "no candidates" and decide whether to surface
 * a soft error or fall through to another source.
 */
export async function webSearchSalafi(
  query: string,
  opts: WebSearchOptions = {},
): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed) return []
  const suffix = opts.suffix ?? 'biografi salaf'
  const fullQuery = `${trimmed} ${suffix}`.trim()
  return runDdgQuery(fullQuery, opts.limit ?? 10, opts.timeoutMs)
}

/**
 * DDG search restricted to a set of whitelist domains via `site:` operators.
 *
 * Builds a query like:
 *   `<name> (site:dorar.net OR site:almanhaj.or.id OR ...)`
 *
 * DDG honours the disjunction up to a handful of domains; we cap with
 * `maxDomains` (default 6) and pick the top-priority entries so noisy
 * results from low-priority domains don't drown out vetted ones.
 *
 * Returns an empty array when DDG returns no usable results. The caller
 * should fall through to `webSearchSalafi` (broader salaf-biased search)
 * before giving up.
 */
export async function webSearchWithinWhitelist(
  query: string,
  domains: string[],
  opts: WebSearchWithinDomainsOptions = {},
): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed || domains.length === 0) return []
  const cap = opts.maxDomains ?? 6
  const selected = domains.slice(0, cap)
  const siteOps = selected.map((d) => `site:${d}`).join(' OR ')
  const fullQuery = `${trimmed} (${siteOps})`
  const limit = opts.limit ?? 10
  const urls = await runDdgQuery(fullQuery, limit, opts.timeoutMs)

  // Defence in depth: filter to whitelist-only in case DDG returns
  // off-domain results (rare but happens with edge cases like cached
  // pages or AMP variants on third-party CDNs).
  const allowed = new Set(selected.map((d) => d.toLowerCase()))
  return urls.filter((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase()
      // Match host or any "<subdomain>.host" suffix against the whitelist.
      return [...allowed].some((d) => host === d || host.endsWith(`.${d}`))
    } catch {
      return false
    }
  })
}

/** Core DDG HTML query runner. Returns parsed result URLs or []. */
async function runDdgQuery(
  fullQuery: string,
  limit: number,
  timeoutMs?: number,
): Promise<string[]> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  let html: string
  try {
    const res = await fetch(DDG_BASE, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
      },
      // DDG HTML accepts the query via either query-string or POST form.
      // POST tends to bypass the lightweight bot challenge applied to GETs.
      body: new URLSearchParams({ q: fullQuery, kl: 'id-id' }).toString(),
      signal: controller.signal,
    })
    if (!res.ok) return []
    html = await res.text()
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }

  return parseDdgResults(html, limit)
}

/**
 * Extract result URLs from a DDG HTML response.
 *
 * DDG HTML wraps clicked URLs in a redirect:
 *   `//duckduckgo.com/l/?uddg=<percent-encoded-real-url>&...`
 * We unwrap to the real URL.
 */
function parseDdgResults(html: string, limit: number): string[] {
  const urls: string[] = []
  // `<a class="result__a" href="…">` — class order is stable.
  const re = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]
    if (!raw) continue
    const real = unwrapDdgRedirect(raw)
    if (!real) continue
    // Cheap dedupe — DDG sometimes lists the same article twice.
    if (!urls.includes(real)) urls.push(real)
    if (urls.length >= limit) break
  }
  return urls
}

function unwrapDdgRedirect(href: string): string | null {
  let candidate = href
  if (candidate.startsWith('//')) candidate = `https:${candidate}`
  // DDG wraps results in `/l/?uddg=<url>`.
  if (candidate.includes('uddg=')) {
    try {
      const u = new URL(candidate, 'https://duckduckgo.com')
      const uddg = u.searchParams.get('uddg')
      if (uddg) return decodeURIComponent(uddg)
    } catch {
      // fall through
    }
  }
  if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
    return candidate
  }
  return null
}
