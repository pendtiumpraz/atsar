// DEV ONLY: small set of demo figures so the app has data to render.
// Production uses AI deep research crawler to populate figures table.
// Run with: pnpm db:seed:dev

import { getSeedDb, logSeed } from './_helpers.js'
import { figures, figureCategories, locations } from '../schema/index.js'

type FigureSeed = {
  slug: string
  categorySlug: string
  gender: 'male' | 'female'
  nameFullAr: string
  nameFullId: string
  kunyahAr?: string
  laqabId?: string
  birthAh?: number
  birthCe?: number
  deathAh?: number
  deathCe?: number
  socialCategory?: ('anshar' | 'muhajirin' | 'qurasy' | 'arab_non_qurasy' | 'mawla' | 'non_arab' | 'other')[]
  rijalGrade?: 'sahabi_udul' | 'thiqah' | 'not_narrator'
  hadithMin?: number
  hadithMax?: number
  primaryLocSlug?: string
  summaryId?: string
}

const FIGURES: FigureSeed[] = [
  // ─── Nabi & Rasul ─────────────────────────────────────────
  {
    slug: 'nabi-muhammad',
    categorySlug: 'nabi',
    gender: 'male',
    nameFullAr: 'محمد بن عبد الله ﷺ',
    nameFullId: 'Muhammad bin Abdullah ﷺ',
    kunyahAr: 'أبو القاسم',
    laqabId: 'Rasulullah',
    birthAh: -53,
    birthCe: 570,
    deathAh: 11,
    deathCe: 632,
    primaryLocSlug: 'makkah',
    rijalGrade: 'not_narrator',
    summaryId: 'Nabi terakhir, pembawa risalah Islam. Lahir di Mekkah, hijrah ke Madinah pada 1 H.',
  },
  // ─── Shalih Pre-Rasul ─────────────────────────────────────
  {
    slug: 'maryam-binti-imran',
    categorySlug: 'shalih_pre_rasul',
    gender: 'female',
    nameFullAr: 'مريم بنت عمران',
    nameFullId: 'Maryam binti Imran',
    laqabId: 'Ibu Nabi Isa AS',
    rijalGrade: 'not_narrator',
    summaryId: 'Wanita shalihah yang disebut dalam Al-Quran, ibu Nabi Isa AS.',
  },
  // ─── Sahabat (Khulafa Rasyidin) ───────────────────────────
  {
    slug: 'abu-bakr-as-shiddiq',
    categorySlug: 'sahabat',
    gender: 'male',
    nameFullAr: 'أبو بكر الصديق رضي الله عنه',
    nameFullId: 'Abu Bakr ash-Shiddiq RA',
    kunyahAr: 'أبو بكر',
    laqabId: 'Ash-Shiddiq',
    birthAh: -50,
    birthCe: 573,
    deathAh: 13,
    deathCe: 634,
    socialCategory: ['muhajirin', 'qurasy'],
    rijalGrade: 'sahabi_udul',
    hadithMin: 142,
    hadithMax: 142,
    primaryLocSlug: 'makkah',
    summaryId: 'Khalifah pertama setelah wafatnya Nabi ﷺ. Pemimpin Tsaqifah, pemerangi nabi palsu & murtaddin.',
  },
  {
    slug: 'umar-bin-khattab',
    categorySlug: 'sahabat',
    gender: 'male',
    nameFullAr: 'عمر بن الخطاب رضي الله عنه',
    nameFullId: 'Umar bin Khattab RA',
    kunyahAr: 'أبو حفص',
    laqabId: 'Al-Faruq',
    birthAh: -40,
    birthCe: 584,
    deathAh: 23,
    deathCe: 644,
    socialCategory: ['muhajirin', 'qurasy'],
    rijalGrade: 'sahabi_udul',
    hadithMin: 537,
    hadithMax: 537,
    primaryLocSlug: 'makkah',
    summaryId: 'Khalifah kedua. Pelopor banyak ijtihad — kalender Hijri, divan administrasi.',
  },
  {
    slug: 'khadijah-binti-khuwailid',
    categorySlug: 'sahabat',
    gender: 'female',
    nameFullAr: 'خديجة بنت خويلد رضي الله عنها',
    nameFullId: 'Khadijah binti Khuwailid RA',
    laqabId: 'Ummul Mukminin',
    birthAh: -68,
    birthCe: 555,
    deathAh: -3,
    deathCe: 619,
    socialCategory: ['qurasy'],
    rijalGrade: 'sahabi_udul',
    primaryLocSlug: 'makkah',
    summaryId: 'Istri pertama Nabi ﷺ, orang pertama yang beriman.',
  },
  {
    slug: 'aisyah-binti-abu-bakr',
    categorySlug: 'sahabat',
    gender: 'female',
    nameFullAr: 'عائشة بنت أبي بكر رضي الله عنها',
    nameFullId: 'Aisyah binti Abu Bakr RA',
    laqabId: 'Ummul Mukminin, Ash-Shiddiqah',
    birthAh: -9,
    birthCe: 614,
    deathAh: 58,
    deathCe: 678,
    socialCategory: ['muhajirin', 'qurasy'],
    rijalGrade: 'sahabi_udul',
    hadithMin: 2210,
    hadithMax: 2210,
    primaryLocSlug: 'madinah',
    summaryId: 'Istri Nabi ﷺ, perawi hadits perempuan terbanyak. Faqihah ummat.',
  },
]

export async function seed017DemoFigures() {
  const db = getSeedDb()
  const cats = await db.select().from(figureCategories)
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]))
  const locs = await db.select().from(locations)
  const locBySlug = new Map(locs.map((l) => [l.slug, l.id]))

  let total = 0
  for (const f of FIGURES) {
    const categoryId = catBySlug.get(f.categorySlug)
    if (!categoryId) continue
    const primaryLocationId = f.primaryLocSlug ? locBySlug.get(f.primaryLocSlug) : undefined
    const result = await db
      .insert(figures)
      .values({
        slug: f.slug,
        categoryId,
        gender: f.gender,
        nameFullAr: f.nameFullAr,
        nameFullId: f.nameFullId,
        kunyahAr: f.kunyahAr,
        laqabId: f.laqabId,
        birthDateAh: f.birthAh,
        birthDateCe: f.birthCe,
        deathDateAh: f.deathAh,
        deathDateCe: f.deathCe,
        socialCategory: f.socialCategory,
        rijalGrade: f.rijalGrade ?? 'unverified',
        hadithCountMin: f.hadithMin,
        hadithCountMax: f.hadithMax,
        primaryLocationId,
        summaryId: f.summaryId,
        status: 'published',
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    if (result.length > 0) total++
  }
  logSeed('demo_figures', total)
}
