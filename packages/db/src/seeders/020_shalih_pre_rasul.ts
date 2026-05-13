// Seeder: Shalih/Shalihah pre-Rasul (figures disebut Quran/Hadits shahih, bukan nabi/rasul)
// Maryam binti Imran sudah diseed di 017_demo_figures.ts — di-skip di sini.

import { getSeedDb, logSeed } from './_helpers.js'
import { figures, figureCategories } from '../schema/index.js'

type FigureSeed = {
  slug: string
  gender: 'male' | 'female'
  nameFullAr: string
  nameFullId: string
  laqabId?: string
  rijalNotesId?: string
  birthDateNotes?: string
  deathDateNotes?: string
  summaryId: string
}

const FIGURES: FigureSeed[] = [
  {
    slug: 'asiyah-binti-muzahim',
    gender: 'female',
    nameFullAr: 'آسِيَة بِنْت مُزَاحِم',
    nameFullId: 'Asiyah binti Muzahim',
    laqabId: 'Istri Fir’aun',
    summaryId:
      'Istri Fir’aun yang beriman kepada Allah; diabadikan dalam QS At-Tahrim ayat 11 sebagai teladan wanita beriman.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui; wafat sebagai syahidah di tangan Fir’aun.',
  },
  {
    slug: 'luqman-al-hakim',
    gender: 'male',
    nameFullAr: 'لُقْمَان الْحَكِيم',
    nameFullId: 'Luqman al-Hakim',
    laqabId: 'Al-Hakim',
    summaryId:
      'Hamba shalih yang dianugerahi hikmah oleh Allah; nasihatnya kepada anaknya diabadikan dalam QS Luqman.',
    rijalNotesId: 'Jumhur ulama berpendapat Luqman adalah hamba shalih yang bijak, bukan seorang nabi.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'ashabul-kahfi',
    gender: 'male',
    nameFullAr: 'أَصْحَاب الْكَهْف',
    nameFullId: 'Ashabul Kahfi',
    laqabId: 'Pemuda Penghuni Gua',
    summaryId:
      'Sekelompok pemuda beriman yang berlindung di dalam gua dan ditidurkan Allah selama bertahun-tahun; kisahnya diabadikan dalam QS Al-Kahfi.',
    rijalNotesId:
      'Entry kelompok (group entry) — merujuk pada sekumpulan pemuda Ashabul Kahfi sebagaimana disebut dalam Al-Quran, bukan satu individu.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'habil-bin-adam',
    gender: 'male',
    nameFullAr: 'هَابِيل بْن آدَم',
    nameFullId: 'Habil bin Adam',
    summaryId:
      'Putra Nabi Adam AS yang qurbannya diterima Allah; terbunuh oleh saudaranya Qabil, dikisahkan dalam QS Al-Maidah ayat 27-31.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Wafat dibunuh oleh saudaranya Qabil; tanggal tidak diketahui.',
  },
  {
    slug: 'khidir',
    gender: 'male',
    nameFullAr: 'الْخَضِر',
    nameFullId: 'Khidir',
    laqabId: 'Al-Khadir',
    summaryId:
      'Hamba Allah yang diberi rahmat dan ilmu ladunni; mendampingi Nabi Musa AS dalam tiga peristiwa sebagaimana QS Al-Kahfi ayat 60-82.',
    rijalNotesId:
      'Terdapat perbedaan pendapat: jumhur ulama Sunni berpendapat Khidir adalah seorang nabi, sebagian lain menilainya hamba shalih yang diberi ilmu khusus. Diseed pada kategori shalih pre-rasul tanpa memutus perdebatan.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'pemuda-ashabul-ukhdud',
    gender: 'male',
    nameFullAr: 'الْغُلَام صَاحِب الْأُخْدُود',
    nameFullId: 'Pemuda Ashabul Ukhdud',
    summaryId:
      'Pemuda beriman dalam kisah Ashabul Ukhdud yang syahid demi tauhid; kisahnya diisyaratkan dalam QS Al-Buruj dan diriwayatkan dalam hadits shahih Muslim.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Wafat sebagai syahid; tanggal tidak diketahui.',
  },
  {
    slug: 'yusya-bin-nun',
    gender: 'male',
    nameFullAr: 'يُوشَع بْن نُون',
    nameFullId: 'Yusya’ bin Nun',
    laqabId: 'Pendamping Musa',
    summaryId:
      'Pendamping Nabi Musa AS yang disebut dalam QS Al-Kahfi ayat 60 sebagai pemuda yang menyertai Musa menuju pertemuan dengan Khidir.',
    rijalNotesId:
      'Sebagian ulama menyebutnya nabi (Yosua bin Nun dari Bani Israil); diseed di kategori shalih pre-rasul.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'thalut',
    gender: 'male',
    nameFullAr: 'طَالُوت',
    nameFullId: 'Thalut',
    laqabId: 'Raja Bani Israil',
    summaryId:
      'Raja Bani Israil yang diangkat Allah untuk memimpin perang melawan Jalut; kisahnya disebut dalam QS Al-Baqarah ayat 246-251.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'hajar-ummu-ismail',
    gender: 'female',
    nameFullAr: 'هَاجَر',
    nameFullId: 'Hajar',
    laqabId: 'Ummu Ismail',
    summaryId:
      'Ibu Nabi Ismail AS; sa’i antara Shafa dan Marwah untuk mencari air bagi putranya menjadi syariat haji, sebagaimana hadits shahih Bukhari.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'sarah-istri-ibrahim',
    gender: 'female',
    nameFullAr: 'سَارَة',
    nameFullId: 'Sarah',
    laqabId: 'Istri Ibrahim, Ibu Ishaq',
    summaryId:
      'Istri Nabi Ibrahim AS dan ibu Nabi Ishaq AS; menerima kabar gembira kelahiran Ishaq di usia tua sebagaimana QS Hud ayat 71-73.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'hannah-binti-faqudz',
    gender: 'female',
    nameFullAr: 'حَنَّة بِنْت فَاقُوذ',
    nameFullId: 'Hannah binti Faqudz',
    laqabId: 'Ibu Maryam, Imra’atu Imran',
    summaryId:
      'Ibu Maryam binti Imran; menazarkan kandungannya untuk berkhidmat di Baitul Maqdis sebagaimana QS Aali Imran ayat 35-37.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
  {
    slug: 'bilqis-ratu-saba',
    gender: 'female',
    nameFullAr: 'بِلْقِيس',
    nameFullId: 'Bilqis',
    laqabId: 'Ratu Saba’',
    summaryId:
      'Ratu negeri Saba’ yang berserah diri kepada Allah bersama Nabi Sulaiman AS; kisahnya diabadikan dalam QS An-Naml ayat 22-44.',
    birthDateNotes: 'Tanggal lahir tidak diketahui secara pasti.',
    deathDateNotes: 'Tanggal wafat tidak diketahui secara pasti.',
  },
]

export async function seed020ShalihPreRasul() {
  const db = getSeedDb()
  const cats = await db.select().from(figureCategories)
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]))
  const categoryId = catBySlug.get('shalih_pre_rasul')
  if (!categoryId) {
    logSeed('shalih_pre_rasul', 0, 'skipped (category missing)')
    return
  }

  let total = 0
  for (const f of FIGURES) {
    const result = await db
      .insert(figures)
      .values({
        slug: f.slug,
        categoryId,
        gender: f.gender,
        nameFullAr: f.nameFullAr,
        nameFullId: f.nameFullId,
        laqabId: f.laqabId,
        birthDateAh: null,
        birthDateCe: null,
        birthDatePrecision: 'approximate',
        birthDateNotes: f.birthDateNotes,
        deathDateAh: null,
        deathDateCe: null,
        deathDatePrecision: 'approximate',
        deathDateNotes: f.deathDateNotes,
        rijalGrade: 'not_narrator',
        rijalNotesId: f.rijalNotesId,
        summaryId: f.summaryId,
        status: 'published',
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    if (result.length > 0) total++
  }
  logSeed('shalih_pre_rasul', total)
}
