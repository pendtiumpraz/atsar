// Whitelist domains untuk AI crawl + citation source.
// Fokus pada situs salafi otoritatif: Saudi (manhaj salafi resmi) + Indonesia
// (kanal ustadz/yayasan ahlussunnah berbahasa Indonesia).
//
// Priority skala 1-10 — higher = AI ranker dahulukan saat fetch. Bahasa
// utama: 'ar' (Arabic), 'id' (Indonesia), 'en' (English).
// REFERENCES.md §C.

import { getSeedDb, logSeed } from './_helpers.js'
import { whitelistDomains } from '../schema/index.js'

const DOMAINS: Array<{
  domain: string
  displayName: string
  primaryLanguage: 'ar' | 'id' | 'en'
  description?: string
  priority: number
  crawlRatePerMinute?: number
}> = [
  // ─── Saudi / Arabic — fatwa & biografi ulama salaf ──────────────────
  { domain: 'binbaz.org.sa', displayName: 'Maktabah Syaikh Ibn Baz', primaryLanguage: 'ar', priority: 10, description: 'Fatwa & rekaman Syaikh Abdul Aziz bin Baz rahimahullah.' },
  { domain: 'binothaimeen.net', displayName: 'Maktabah Syaikh Ibn Utsaimin', primaryLanguage: 'ar', priority: 10, description: 'Fatwa & syarah Syaikh Muhammad bin Shalih al-Utsaimin rahimahullah.' },
  { domain: 'alalbany.net', displayName: 'Maktabah Syaikh al-Albani', primaryLanguage: 'ar', priority: 10, description: 'Karya & fatwa Syaikh Nashiruddin al-Albani rahimahullah.' },
  { domain: 'alfawzan.af.org.sa', displayName: 'Maktabah Syaikh Shalih al-Fawzan', primaryLanguage: 'ar', priority: 10, description: 'Fatwa Syaikh Shalih al-Fawzan hafizhahullah.' },
  { domain: 'alifta.gov.sa', displayName: 'Lajnah Daimah (Komite Fatwa Saudi)', primaryLanguage: 'ar', priority: 10, description: 'Fatwa resmi Lajnah Daimah lil-Buhuts wal-Ifta.' },
  { domain: 'rabee.net', displayName: 'Maktabah Syaikh Rabee al-Madkhali', primaryLanguage: 'ar', priority: 9, description: 'Karya & bayan Syaikh Rabee bin Hadi al-Madkhali.' },
  { domain: 'sahab.net', displayName: 'Sahab Net', primaryLanguage: 'ar', priority: 8, description: 'Forum salafi Saudi — fatwa & bayan ulama.' },
  { domain: 'ajurry.com', displayName: "Maktabah al-Ajurri", primaryLanguage: 'ar', priority: 8, description: 'Kompilasi karya ulama salaf, fokus aqidah.' },
  { domain: 'al-aqidah.com', displayName: 'Al-Aqidah', primaryLanguage: 'ar', priority: 7, description: 'Artikel aqidah ahlussunnah.' },
  { domain: 'kulalsalafiyeen.com', displayName: 'Kullu as-Salafiyyin', primaryLanguage: 'ar', priority: 7, description: 'Portal salafi Saudi.' },

  // ─── Generic Arabic — ensiklopedia & rijal ──────────────────────────
  { domain: 'dorar.net', displayName: 'Durar as-Saniyyah', primaryLanguage: 'ar', priority: 10, description: "Mausu'ah rijal & ensiklopedia hadits/aqidah." },
  { domain: 'islamqa.info', displayName: 'IslamQA (Syaikh Munajjid)', primaryLanguage: 'ar', priority: 9, description: 'Fatwa & biografi oleh Syaikh Shalih al-Munajjid.' },
  { domain: 'shamela.ws', displayName: 'Maktabah Syamilah', primaryLanguage: 'ar', priority: 9, description: 'Perpustakaan kitab klasik online — sumber primer.', crawlRatePerMinute: 10 },
  { domain: 'islamweb.net', displayName: 'Islamweb', primaryLanguage: 'ar', priority: 6, description: 'Fatwa & artikel umum.' },
  { domain: 'alukah.net', displayName: 'Alukah', primaryLanguage: 'ar', priority: 6, description: 'Artikel ilmiah, beragam tema.' },

  // ─── Salafi Indonesia (bahasa Indonesia) ────────────────────────────
  { domain: 'almanhaj.or.id', displayName: 'Almanhaj.or.id', primaryLanguage: 'id', priority: 10, description: 'Portal salafi Indonesia tertua — terjemah karya ulama Saudi.' },
  { domain: 'muslim.or.id', displayName: 'Muslim.or.id', primaryLanguage: 'id', priority: 10, description: 'YPIA Yogyakarta — artikel manhaj, fiqh, aqidah.' },
  { domain: 'rumaysho.com', displayName: 'Rumaysho.com', primaryLanguage: 'id', priority: 10, description: 'Ust. Muhammad Abduh Tuasikal — fiqh, biografi salaf.' },
  { domain: 'konsultasisyariah.com', displayName: 'Konsultasi Syariah', primaryLanguage: 'id', priority: 9, description: 'Ust. Ammi Nur Baits — tanya-jawab fiqh & manhaj.' },
  { domain: 'asysyariah.com', displayName: 'Majalah Asy Syariah', primaryLanguage: 'id', priority: 9, description: 'Majalah salafi Indonesia — manhaj, fiqh, sirah.' },
  { domain: 'salafy.or.id', displayName: 'Salafy.or.id', primaryLanguage: 'id', priority: 8, description: 'Portal salafi Indonesia.' },
  { domain: 'darussalaf.or.id', displayName: 'Darussalaf', primaryLanguage: 'id', priority: 8, description: 'Yayasan Darussalaf — kajian & artikel manhaj.' },
  { domain: 'thoriqussalaf.com', displayName: 'Thoriqus Salaf', primaryLanguage: 'id', priority: 7, description: 'Artikel manhaj salaf Indonesia.' },
  { domain: 'abusalma.net', displayName: 'Abu Salma', primaryLanguage: 'id', priority: 7, description: 'Tulisan Ust. Abu Salma Muhammad — manhaj & sirah.' },
  { domain: 'mahad-assalafy.com', displayName: "Ma'had as-Salafy", primaryLanguage: 'id', priority: 7, description: "Portal ma'had salafy Jember." },
  { domain: 'firanda.com', displayName: 'Firanda.com', primaryLanguage: 'id', priority: 7, description: 'Ust. Firanda Andirja — sirah, aqidah, hadits.' },
  { domain: 'kajian.net', displayName: 'Kajian.net', primaryLanguage: 'id', priority: 6, description: 'Arsip kajian salafi Indonesia (audio + transkrip).' },

  // ─── English — secondary references ─────────────────────────────────
  { domain: 'sunnah.com', displayName: 'Sunnah.com', primaryLanguage: 'en', priority: 7, description: 'Database hadits Kutub Sittah + biografi perawi.' },
  { domain: 'spubs.com', displayName: 'Salafi Publications', primaryLanguage: 'en', priority: 7, description: 'Maktabah salafi Birmingham — terjemah ulama Saudi.' },
  { domain: 'troid.org', displayName: 'TROID', primaryLanguage: 'en', priority: 6, description: 'The Reliance on the Imaam & Daleel — sumber salafi berbahasa Inggris.' },
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
