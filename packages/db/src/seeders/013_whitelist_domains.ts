import { getSeedDb, logSeed } from './_helpers.js'
import { whitelistDomains } from '../schema/index.js'

// REFERENCES.md §C.
const DOMAINS: Array<{
  domain: string
  displayName: string
  primaryLanguage: 'ar' | 'id' | 'en'
  description?: string
  priority: number
  crawlRatePerMinute?: number
}> = [
  { domain: 'islamqa.info', displayName: 'IslamQA (Syaikh Munajjid)', primaryLanguage: 'ar', priority: 10, description: 'Fatwa & biografi.' },
  { domain: 'dorar.net', displayName: 'Durar as-Saniyyah', primaryLanguage: 'ar', priority: 10, description: 'Mausu\'ah rijal & ensiklopedia.' },
  { domain: 'islamweb.net', displayName: 'Islamweb', primaryLanguage: 'ar', priority: 8, description: 'Fatwa & artikel.' },
  { domain: 'shamela.ws', displayName: 'Maktabah Syamilah', primaryLanguage: 'ar', priority: 9, description: 'Kitab klasik online.', crawlRatePerMinute: 10 },
  { domain: 'sunnah.com', displayName: 'Sunnah.com', primaryLanguage: 'en', priority: 7, description: 'Hadits + rijal.' },
  { domain: 'alukah.net', displayName: 'Alukah', primaryLanguage: 'ar', priority: 6, description: 'Artikel ilmiah.' },
]

export async function seed013WhitelistDomains() {
  const db = getSeedDb()
  const data = DOMAINS.map((d) => ({
    domain: d.domain,
    displayName: d.displayName,
    primaryLanguage: d.primaryLanguage,
    description: d.description,
    isActive: true,
    priority: d.priority,
    crawlRatePerMinute: d.crawlRatePerMinute ?? 30,
  }))
  const result = await db
    .insert(whitelistDomains)
    .values(data)
    .onConflictDoNothing()
    .returning()
  logSeed('whitelist_domains', result.length)
}
