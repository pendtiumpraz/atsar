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

/**
 * Strip honorifics, salaf-greeting suffixes, and stray punctuation that
 * hurt search relevance. DDG sees `العباس بن عبد المطلب رضي الله عنه` and
 * tries to match all five tokens exactly; almost no whitelist article
 * carries the full greeting in its title, so the query returns zero hits.
 *
 * Patterns covered:
 *   - Arabic: `رضي الله عنه`, `رضي الله عنها`, `صلى الله عليه وسلم`, `ﷺ`
 *   - Indonesian/Latin: ` RA`, ` r.a.`, ` SAW`, ` s.a.w.`, ` AS`, ` a.s.`,
 *     ` rh.`, ` rha.`, ` ra.`, ` rahimahullah`
 *   - Brackets / quotes / repeated whitespace.
 */
export function normalizeFigureNameForSearch(raw: string): string {
  let name = raw
  // Arabic honorifics (with optional brackets).
  name = name.replace(
    /[(\[]?\s*(?:رضي\s*الله\s*عنه(?:م|ا|ما)?|صلى\s*الله\s*عليه\s*و(?:آله\s*و)?سلم|عليه\s*السلام|رحمه\s*الله|ﷺ)\s*[)\]]?/g,
    '',
  )
  // Latin honorific suffixes — match a leading separator so we don't eat
  // the figure's actual name when "ra" appears mid-word.
  name = name.replace(
    /(?:\s|^)(?:RA|R\.A\.|RA\.|SAW|S\.A\.W\.|SAW\.|AS|A\.S\.|rh\.?|rha\.?|ra\.?|rahimahullah|hafidzahullah)\b\.?/gi,
    ' ',
  )
  // Collapse whitespace + drop stray punctuation pairs left behind.
  name = name.replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim()
  return name
}

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

export interface WhitelistDomainSpec {
  domain: string
  primaryLanguage?: string | null
}

export interface DualLangSearchInput {
  /** Arabic name (e.g. `العباس بن عبد المطلب`). Used to query Arabic-language
   *  whitelist domains. Optional — fall back to `nameId` when absent. */
  nameAr?: string | null
  /** Indonesian transliteration (e.g. `Abbas bin Abdul Muthalib`). Used to
   *  query Indonesian + English whitelist domains. */
  nameId?: string | null
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
  const normalized = normalizeFigureNameForSearch(query)
  if (!normalized) return []
  const suffix = opts.suffix ?? 'biografi salaf'
  const fullQuery = `${normalized} ${suffix}`.trim()
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
  const normalized = normalizeFigureNameForSearch(query)
  if (!normalized || domains.length === 0) return []
  const cap = opts.maxDomains ?? 6
  const selected = domains.slice(0, cap)
  const siteOps = selected.map((d) => `site:${d}`).join(' OR ')
  const fullQuery = `${normalized} (${siteOps})`
  const limit = opts.limit ?? 10
  const urls = await runDdgQuery(fullQuery, limit, opts.timeoutMs)
  return filterToWhitelist(urls, selected)
}

/**
 * Dual-language whitelist search. Splits domains by `primaryLanguage`:
 *   - `ar` domains (dorar.net, islamqa.info, shamela.ws, binbaz.org.sa, …)
 *     get queried with the Arabic figure name.
 *   - `id` / `en` / unknown domains (almanhaj.or.id, rumaysho.com,
 *     muslim.or.id, sunnah.com, …) get queried with the Indonesian
 *     transliteration.
 *
 * Why: DDG's `site:` operator is matched against the page's *indexed*
 * tokens. An Arabic page has Arabic tokens; querying it with the Latin
 * transliteration produces zero matches even when the article is there.
 * Splitting the search recovers both halves of the whitelist.
 *
 * URLs from both buckets are merged + deduped before return. Hard cap
 * `limit` total. Domains without a `primaryLanguage` are queried with
 * whichever name is non-empty, preferring Indonesian.
 */
export async function webSearchWithinWhitelistDual(
  input: DualLangSearchInput,
  domains: WhitelistDomainSpec[],
  opts: WebSearchWithinDomainsOptions = {},
): Promise<string[]> {
  const nameAr = normalizeFigureNameForSearch(input.nameAr ?? '')
  const nameId = normalizeFigureNameForSearch(input.nameId ?? '')
  if ((!nameAr && !nameId) || domains.length === 0) return []

  const cap = opts.maxDomains ?? 6
  const limit = opts.limit ?? 10
  const arabicDomains: string[] = []
  const otherDomains: string[] = []
  for (const d of domains) {
    if (d.primaryLanguage === 'ar') arabicDomains.push(d.domain)
    else otherDomains.push(d.domain)
  }

  const queries: Array<Promise<string[]>> = []
  if (nameAr && arabicDomains.length > 0) {
    const selected = arabicDomains.slice(0, cap)
    const siteOps = selected.map((d) => `site:${d}`).join(' OR ')
    queries.push(
      runDdgQuery(`${nameAr} (${siteOps})`, limit, opts.timeoutMs).then((urls) =>
        filterToWhitelist(urls, selected),
      ),
    )
  }
  if (nameId && otherDomains.length > 0) {
    const selected = otherDomains.slice(0, cap)
    const siteOps = selected.map((d) => `site:${d}`).join(' OR ')
    queries.push(
      runDdgQuery(`${nameId} (${siteOps})`, limit, opts.timeoutMs).then((urls) =>
        filterToWhitelist(urls, selected),
      ),
    )
  }
  // Fallback when the figure has only one language filled — still try the
  // other name against the opposite bucket so we don't lose half the
  // whitelist by omission.
  if (nameId && arabicDomains.length > 0 && !nameAr) {
    const selected = arabicDomains.slice(0, cap)
    const siteOps = selected.map((d) => `site:${d}`).join(' OR ')
    queries.push(
      runDdgQuery(`${nameId} (${siteOps})`, limit, opts.timeoutMs).then((urls) =>
        filterToWhitelist(urls, selected),
      ),
    )
  }
  if (nameAr && otherDomains.length > 0 && !nameId) {
    const selected = otherDomains.slice(0, cap)
    const siteOps = selected.map((d) => `site:${d}`).join(' OR ')
    queries.push(
      runDdgQuery(`${nameAr} (${siteOps})`, limit, opts.timeoutMs).then((urls) =>
        filterToWhitelist(urls, selected),
      ),
    )
  }

  const settled = await Promise.allSettled(queries)
  const merged: string[] = []
  const seen = new Set<string>()
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue
    for (const url of r.value) {
      if (seen.has(url)) continue
      seen.add(url)
      merged.push(url)
      if (merged.length >= limit) return merged
    }
  }
  return merged
}

/** Defence in depth: drop any URL whose host isn't in the whitelist set,
 *  so DDG cache redirects / AMP variants can't smuggle off-domain results
 *  past the caller. Matches host or any `<subdomain>.host`. */
function filterToWhitelist(urls: string[], allowedDomains: string[]): string[] {
  const allowed = new Set(allowedDomains.map((d) => d.toLowerCase()))
  return urls.filter((u) => {
    try {
      const host = new URL(u).hostname.toLowerCase()
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
