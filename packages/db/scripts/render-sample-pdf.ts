// Render-sample script — builds the HTML for each PDF template against
// a small synthetic fixture (Abu Bakr, Aisyah, Imam Bukhari) and writes
// the output to `packages/db/tmp/atsar-sample-<slug>.html` so designers
// can open the file in a browser and visually verify the layout.
//
// We deliberately don't run Puppeteer here — that requires the
// `@sparticuz/chromium` binary which fails in a typical CI sandbox. The
// HTML output is portable and good enough for static checks; the actual
// PDF render is verified end-to-end by the production `/api/jobs/pdf`
// route once a real job is enqueued.
//
// Usage:
//   pnpm --filter @athar/db tsx scripts/render-sample-pdf.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// We import the template builders directly from the web app — they're
// pure functions of `TemplateInput` and have no DB / server-only deps
// beyond the schema types.
import { buildHtml as buildClassic } from '../../../apps/web/lib/server/pdf/templates/classic.ts'
import { buildHtml as buildModern } from '../../../apps/web/lib/server/pdf/templates/modern.ts'
import { buildHtml as buildCalligraphy } from '../../../apps/web/lib/server/pdf/templates/calligraphy.ts'
import { buildHtml as buildMinimalist } from '../../../apps/web/lib/server/pdf/templates/minimalist.ts'
import type {
  FigureRich,
  TemplateInput,
} from '../../../apps/web/lib/server/pdf/templates/index.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../tmp')
mkdirSync(outDir, { recursive: true })

// ── Fixture data ─────────────────────────────────────────────────────
// Hand-crafted to exercise every template region: a famous saying that
// gets pulled into the pull-quote, multi-paragraph biography with a
// citation marker, plus citation rows for the footnotes block.

const baseDates = new Date()

function makeFixture(): FigureRich[] {
  return [
    {
      // Abu Bakr ash-Shiddiq
      id: '00000000-0000-0000-0000-000000000001',
      slug: 'abu-bakr-as-shiddiq',
      categoryId: '00000000-0000-0000-0000-0000000000aa',
      gender: 'male',
      nameFullAr: 'أَبُو بَكْرٍ الصِّدِّيق رضي الله عنه',
      nameFullId: 'Abu Bakr ash-Shiddiq',
      nameShortAr: 'أبو بكر',
      nameShortId: 'Abu Bakr',
      kunyahAr: 'أَبُو بَكْرٍ',
      kunyahId: 'Abu Bakr',
      laqabAr: 'الصِّدِّيق',
      laqabId: 'ash-Shiddiq',
      birthDateAh: -53,
      birthDateCe: 573,
      birthDateAhFull: null,
      birthDateCeFull: null,
      birthDatePrecision: 'year',
      birthDateNotes: null,
      deathDateAh: 13,
      deathDateCe: 634,
      deathDateAhFull: null,
      deathDateCeFull: null,
      deathDatePrecision: 'year',
      deathDateNotes: null,
      deathStatus: 'died',
      deathCause: 'natural',
      socialCategory: ['sahabah'] as unknown as FigureRich['socialCategory'],
      specialty: ['Khalifah', 'Tijarah'],
      madhab: null,
      rijalGrade: 'sahabi',
      rijalNotesAr: null,
      rijalNotesId: null,
      hadithCountMin: 142,
      hadithCountMax: 142,
      summaryAr:
        'قال رسول الله ﷺ: «لو كنتُ متخذًا خليلًا لاتخذتُ أبا بكرٍ خليلًا.»',
      summaryId:
        'Abu Bakr adalah sahabat paling utama dan khalifah pertama. Beliau "selalu membenarkan" Rasulullah ﷺ sebelum siapa pun.',
      biographyAr:
        'وُلِدَ أَبُو بَكْرٍ الصِّدِّيق رضي الله عنه بمكة المكرمة، ونشأ في بيت تجارة كريم. كان من أوائل من آمن بالنبي ﷺ من الرجال الأحرار.\n\nرافق النبي ﷺ في الهجرة إلى المدينة، فنزلت فيه الآية: «ثَانِيَ اثْنَيْنِ إِذْ هُمَا فِي الْغَارِ».',
      biographyId:
        'Abu Bakr ash-Shiddiq lahir di Makkah pada tahun gajah, sekitar dua tahun setelah Rasulullah ﷺ. Beliau tumbuh di lingkungan saudagar terhormat dan dikenal jujur sejak muda, sehingga ketika risalah Islam datang, beliau termasuk orang pertama yang menerimanya tanpa keraguan sedikit pun.[1]\n\nKesetiaannya kepada Rasulullah ﷺ ditampakkan secara paripurna dalam peristiwa Hijrah. Saat orang-orang Quraisy mengejar Nabi ﷺ, Abu Bakr menemani beliau bersembunyi di Gua Tsur — momen yang diabadikan dalam Al-Qur\'an surah at-Taubah ayat 40.[2]\n\nSepeninggal Rasulullah ﷺ, Abu Bakr diangkat menjadi khalifah pertama melalui bai\'at di Saqifah Bani Sa\'idah. Dalam masa kepemimpinan yang singkat (dua tahun lebih beberapa bulan), beliau berhasil menumpas gerakan riddah, memperkokoh Madinah, dan memerintahkan pengumpulan mushaf.',
      biographyPreWafatAr: null,
      biographyPreWafatId: null,
      biographyPostWafatAr: null,
      biographyPostWafatId: null,
      primaryLocationId: null,
      deathLocationId: null,
      burialLocationId: null,
      status: 'published',
      publishedAt: baseDates,
      createdAt: baseDates,
      updatedAt: baseDates,
      deletedAt: null,
      relations: [],
      locations: [
        {
          id: 'l1' as unknown as string,
          figureId: '00000000-0000-0000-0000-000000000001',
          locationId: 'loc-mekkah' as unknown as string,
          role: 'birth',
          periodStartAh: null,
          periodEndAh: null,
          notesAr: null,
          notesId: null,
          createdAt: baseDates,
          updatedAt: baseDates,
          deletedAt: null,
        },
        {
          id: 'l2' as unknown as string,
          figureId: '00000000-0000-0000-0000-000000000001',
          locationId: 'loc-madinah' as unknown as string,
          role: 'residence',
          periodStartAh: 1,
          periodEndAh: 13,
          notesAr: null,
          notesId: null,
          createdAt: baseDates,
          updatedAt: baseDates,
          deletedAt: null,
        },
      ] as unknown as FigureRich['locations'],
      citations: [
        {
          id: 'c1',
          contentType: 'figure',
          contentId: '00000000-0000-0000-0000-000000000001',
          fieldPath: 'biographyId',
          sourceUrl: 'https://shamela.ws/book/123',
          sourceDomain: 'shamela.ws',
          sourceExcerptAr: null,
          sourceExcerptId:
            'Ibn Hisham, as-Sirah an-Nabawiyyah, jilid 1 hal. 234.',
          sourceLang: 'ar',
          extractedAt: baseDates,
          modelUsed: null,
          confidenceScore: '0.92',
          createdAt: baseDates,
          updatedAt: baseDates,
          deletedAt: null,
        },
        {
          id: 'c2',
          contentType: 'figure',
          contentId: '00000000-0000-0000-0000-000000000001',
          fieldPath: 'biographyId',
          sourceUrl: 'https://quran.com/9/40',
          sourceDomain: 'quran.com',
          sourceExcerptAr: null,
          sourceExcerptId:
            'Al-Qur\'an surah at-Taubah (9) ayat 40 — kisah Gua Tsur.',
          sourceLang: 'ar',
          extractedAt: baseDates,
          modelUsed: null,
          confidenceScore: '1.00',
          createdAt: baseDates,
          updatedAt: baseDates,
          deletedAt: null,
        },
      ] as unknown as FigureRich['citations'],
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      slug: 'aisyah-binti-abi-bakr',
      categoryId: '00000000-0000-0000-0000-0000000000bb',
      gender: 'female',
      nameFullAr: 'عَائِشَة بِنْت أَبِي بَكْرٍ رضي الله عنها',
      nameFullId: '‘Aisyah binti Abu Bakr',
      nameShortAr: 'عائشة',
      nameShortId: '‘Aisyah',
      kunyahAr: 'أُمُّ عَبْدِ ٱللَّٰهِ',
      kunyahId: 'Ummu Abdullah',
      laqabAr: 'الصِّدِّيقَة',
      laqabId: 'ash-Shiddiqah',
      birthDateAh: -9,
      birthDateCe: 614,
      birthDateAhFull: null,
      birthDateCeFull: null,
      birthDatePrecision: 'year',
      birthDateNotes: null,
      deathDateAh: 58,
      deathDateCe: 678,
      deathDateAhFull: null,
      deathDateCeFull: null,
      deathDatePrecision: 'year',
      deathDateNotes: null,
      deathStatus: 'died',
      deathCause: 'natural',
      socialCategory: ['sahabiyah'] as unknown as FigureRich['socialCategory'],
      specialty: ['Hadits', 'Fiqh', 'Tafsir'],
      madhab: null,
      rijalGrade: 'sahabi',
      rijalNotesAr: null,
      rijalNotesId: null,
      hadithCountMin: 2210,
      hadithCountMax: 2210,
      summaryAr: null,
      summaryId:
        'Ummul Mu\'minin "Aisyah dikenal sebagai salah satu periwayat hadits terbanyak dari kalangan wanita."',
      biographyAr:
        'كانت عَائِشَة رضي الله عنها من أعلم نساء الأمة، وقد روت عن النبي ﷺ آلاف الأحاديث في الفقه والتفسير والسير.',
      biographyId:
        '‘Aisyah binti Abu Bakr adalah Ummul Mu\'minin yang paling banyak meriwayatkan hadits Rasulullah ﷺ dari kalangan wanita. Beliau tumbuh di rumah ilmu — ayahnya Abu Bakr, sahabatnya Rasulullah ﷺ, lingkungannya para sahabat besar.\n\nSetelah wafatnya Rasulullah ﷺ, rumah ‘Aisyah menjadi madrasah bagi tabi\'in. Beliau wafat di Madinah pada tahun 58 H dan dimakamkan di Baqi\'.',
      biographyPreWafatAr: null,
      biographyPreWafatId: null,
      biographyPostWafatAr: null,
      biographyPostWafatId: null,
      primaryLocationId: null,
      deathLocationId: null,
      burialLocationId: null,
      status: 'published',
      publishedAt: baseDates,
      createdAt: baseDates,
      updatedAt: baseDates,
      deletedAt: null,
      relations: [],
      locations: [],
      citations: [],
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      slug: 'imam-al-bukhari',
      categoryId: '00000000-0000-0000-0000-0000000000cc',
      gender: 'male',
      nameFullAr:
        'مُحَمَّد بْن إِسْمَاعِيل البُخَارِيّ',
      nameFullId: 'Muhammad bin Isma‘il al-Bukhari',
      nameShortAr: 'البخاري',
      nameShortId: 'Al-Bukhari',
      kunyahAr: 'أَبُو عَبْدِ ٱللَّٰهِ',
      kunyahId: 'Abu Abdullah',
      laqabAr: 'أَمِيرُ الْمُؤْمِنِينَ فِي الْحَدِيث',
      laqabId: 'Amirul Mukminin fil Hadits',
      birthDateAh: 194,
      birthDateCe: 810,
      birthDateAhFull: null,
      birthDateCeFull: null,
      birthDatePrecision: 'year',
      birthDateNotes: null,
      deathDateAh: 256,
      deathDateCe: 870,
      deathDateAhFull: null,
      deathDateCeFull: null,
      deathDatePrecision: 'year',
      deathDateNotes: null,
      deathStatus: 'died',
      deathCause: 'natural',
      socialCategory: ['ulama'] as unknown as FigureRich['socialCategory'],
      specialty: ['Hadits', 'Jarh wa Ta\'dil', 'Tarikh'],
      madhab: 'syafii',
      rijalGrade: 'tsiqah',
      rijalNotesAr: null,
      rijalNotesId: null,
      hadithCountMin: 7397,
      hadithCountMax: 7397,
      summaryAr: null,
      summaryId:
        'Al-Bukhari adalah penyusun "al-Jami\' ash-Shahih" yang dianggap kitab paling shahih setelah Al-Qur\'an.',
      biographyAr:
        'وُلِدَ مُحَمَّد بْن إِسْمَاعِيل البُخَارِيّ بمدينة بُخَارَى في شوال سنة 194 هـ، وحفظ القرآن والحديث صغيرًا.',
      biographyId:
        'Muhammad bin Isma‘il al-Bukhari lahir di Bukhara, Asia Tengah, pada bulan Syawwal tahun 194 H. Sejak kecil beliau telah menghafal banyak hadits, dan pada usia enam belas tahun telah menguasai karya-karya Ibn al-Mubarak dan Waki\'.[1]\n\nPerjalanan ilmiahnya menempuh lebih dari empat puluh kota — Makkah, Madinah, Bashrah, Kufah, Damaskus, Mesir — di mana beliau bertemu lebih dari seribu guru. Karya monumentalnya, al-Jami\' ash-Shahih, disusun selama enam belas tahun penyaringan dari sekitar enam ratus ribu riwayat.\n\nImam al-Bukhari wafat di desa Khartank dekat Samarqand pada malam Idul Fitri tahun 256 H, dan tetap menjadi rujukan utama dalam ilmu hadits hingga hari ini.',
      biographyPreWafatAr: null,
      biographyPreWafatId: null,
      biographyPostWafatAr: null,
      biographyPostWafatId: null,
      primaryLocationId: null,
      deathLocationId: null,
      burialLocationId: null,
      status: 'published',
      publishedAt: baseDates,
      createdAt: baseDates,
      updatedAt: baseDates,
      deletedAt: null,
      relations: [],
      locations: [],
      citations: [
        {
          id: 'c3',
          contentType: 'figure',
          contentId: '00000000-0000-0000-0000-000000000003',
          fieldPath: 'biographyId',
          sourceUrl: 'https://shamela.ws/book/26592',
          sourceDomain: 'shamela.ws',
          sourceExcerptAr: null,
          sourceExcerptId:
            'Ibn Hajar al-Asqalani, Hady as-Sari muqaddimah Fath al-Bari.',
          sourceLang: 'ar',
          extractedAt: baseDates,
          modelUsed: null,
          confidenceScore: '0.95',
          createdAt: baseDates,
          updatedAt: baseDates,
          deletedAt: null,
        },
      ] as unknown as FigureRich['citations'],
    },
  ] as unknown as FigureRich[]
}

// ── Run all four templates ──────────────────────────────────────────

const fixtures = makeFixture()

const input: TemplateInput = {
  titleAr: 'مَوْسُوعَة سِيَر السَّلَف الصَّالِح',
  titleId: 'Ensiklopedia Sirah Salafus Shalih',
  subtitleId: 'Tiga tokoh kunci dari masa pembentukan umat',
  authorName: 'Ahmad bin Yusuf',
  authorEmail: 'ahmad@example.test',
  figures: fixtures,
  languageMode: 'both',
  includeIllustrations: true,
  includeMaps: true,
  includeTimeline: true,
}

const renderers: Array<{ slug: string; build: (i: TemplateInput) => string }> = [
  { slug: 'classic', build: buildClassic },
  { slug: 'modern', build: buildModern },
  { slug: 'calligraphy', build: buildCalligraphy },
  { slug: 'minimalist', build: buildMinimalist },
]

for (const r of renderers) {
  const html = r.build(input)
  const file = resolve(outDir, `atsar-sample-${r.slug}.html`)
  writeFileSync(file, html, 'utf8')
  console.log(`  ✓ ${r.slug.padEnd(12)} → ${file} (${(html.length / 1024).toFixed(1)} KB)`)
}

console.log('\nDone. Open the HTML files in a browser to preview each template.')
