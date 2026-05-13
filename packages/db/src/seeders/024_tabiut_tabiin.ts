// Seeder: Tabi'ut Tabi'in & generasi salaf berikutnya (4 Imam Mazhab, Kutub Sittah,
// muhaddits/rijal besar, imam Qira'at, dan beberapa tabi'at-tabi'iyyat).
// Idempotent: onConflictDoNothing pada slug.

import { getSeedDb, logSeed } from './_helpers.js'
import { figures, figureCategories, locations } from '../schema/index.js'

type Madhab = 'shafii' | 'maliki' | 'hanafi' | 'hanbali' | 'zhahiri' | 'no_madhab'
type RijalGrade =
  | 'sahabi_udul'
  | 'thiqah_thiqah'
  | 'thiqah_hafidz'
  | 'thiqah'
  | 'saduq'
  | 'la_basa_bih'
  | 'shalih_al_hadith'
  | 'layyin'
  | 'daif'
  | 'matruk'
  | 'kadhdhab'
  | 'not_narrator'
  | 'unverified'

type FigureSeed = {
  slug: string
  gender: 'male' | 'female'
  nameFullAr: string
  nameFullId: string
  kunyahAr?: string
  laqabId?: string
  birthAh?: number
  deathAh: number
  specialty?: string[]
  madhab?: Madhab
  rijalGrade: RijalGrade
  hadithMin?: number
  hadithMax?: number
  primaryLocSlug?: string
  summaryId: string
}

const FIGURES: FigureSeed[] = [
  // ─── 4 Imam Mazhab ────────────────────────────────────────
  {
    slug: 'imam-abu-hanifah',
    gender: 'male',
    nameFullAr: 'أبو حنيفة النعمان بن ثابت رحمه الله',
    nameFullId: "Abu Hanifah an-Nu'man bin Tsabit rahimahullah",
    kunyahAr: 'أبو حنيفة',
    laqabId: "Imam al-A'zham",
    birthAh: 80,
    deathAh: 150,
    specialty: ['fiqh', 'hadith'],
    madhab: 'hanafi',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'kufah',
    summaryId:
      "Imam mazhab Hanafi, pendiri madrasah ahli ra'yi di Kufah; dijuluki Imam al-A'zham.",
  },
  {
    slug: 'imam-malik-bin-anas',
    gender: 'male',
    nameFullAr: 'مالك بن أنس الأصبحي رحمه الله',
    nameFullId: 'Malik bin Anas al-Ashbahi rahimahullah',
    kunyahAr: 'أبو عبد الله',
    laqabId: 'Imam Dar al-Hijrah',
    birthAh: 93,
    deathAh: 179,
    specialty: ['fiqh', 'hadith'],
    madhab: 'maliki',
    rijalGrade: 'thiqah_thiqah',
    primaryLocSlug: 'madinah',
    summaryId:
      "Imam mazhab Maliki, penyusun al-Muwaththa'; dijuluki Imam Dar al-Hijrah karena tidak pernah meninggalkan Madinah.",
  },
  {
    slug: 'imam-asy-syafii',
    gender: 'male',
    nameFullAr: 'محمد بن إدريس الشافعي رحمه الله',
    nameFullId: "Muhammad bin Idris asy-Syafi'i rahimahullah",
    kunyahAr: 'أبو عبد الله',
    laqabId: 'Nashirus Sunnah',
    birthAh: 150,
    deathAh: 204,
    specialty: ['fiqh', 'hadith', 'ushul_fiqh'],
    madhab: 'shafii',
    rijalGrade: 'thiqah_thiqah',
    primaryLocSlug: 'fustat',
    summaryId:
      "Imam mazhab Syafi'i, lahir di Ghaza dan wafat di Mesir; peletak dasar ilmu Ushul al-Fiqh melalui ar-Risalah.",
  },
  {
    slug: 'imam-ahmad-bin-hanbal',
    gender: 'male',
    nameFullAr: 'أحمد بن حنبل الشيباني رحمه الله',
    nameFullId: 'Ahmad bin Hanbal asy-Syaibani rahimahullah',
    kunyahAr: 'أبو عبد الله',
    laqabId: 'Imam Ahlus Sunnah',
    birthAh: 164,
    deathAh: 241,
    specialty: ['hadith', 'fiqh'],
    madhab: 'hanbali',
    rijalGrade: 'thiqah_thiqah',
    hadithMin: 27000,
    hadithMax: 30000,
    primaryLocSlug: 'baghdad',
    summaryId:
      "Imam mazhab Hanbali, penyusun al-Musnad; teguh menghadapi fitnah Khalq al-Qur'an di masa Mihnah.",
  },

  // ─── Kutub Sittah ─────────────────────────────────────────
  {
    slug: 'imam-bukhari',
    gender: 'male',
    nameFullAr: 'محمد بن إسماعيل البخاري رحمه الله',
    nameFullId: 'Muhammad bin Ismail al-Bukhari rahimahullah',
    kunyahAr: 'أبو عبد الله',
    laqabId: 'Amirul Mukminin fil Hadits',
    birthAh: 194,
    deathAh: 256,
    specialty: ['hadith', 'rijal', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    hadithMin: 2602,
    hadithMax: 7563,
    primaryLocSlug: 'bukhara',
    summaryId:
      'Penyusun Shahih al-Bukhari, kitab paling shahih setelah al-Quran; menyaring ribuan hadits menjadi sekitar 7.563 hadits dengan pengulangan.',
  },
  {
    slug: 'imam-muslim',
    gender: 'male',
    nameFullAr: 'مسلم بن الحجاج القشيري النيسابوري رحمه الله',
    nameFullId: 'Muslim bin al-Hajjaj al-Qusyairi an-Naysaburi rahimahullah',
    kunyahAr: 'أبو الحسين',
    birthAh: 204,
    deathAh: 261,
    specialty: ['hadith', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    hadithMin: 4000,
    hadithMax: 7500,
    primaryLocSlug: 'naysabur',
    summaryId:
      'Penyusun Shahih Muslim, kitab paling shahih kedua setelah Shahih al-Bukhari; murid Imam al-Bukhari.',
  },
  {
    slug: 'imam-abu-dawud',
    gender: 'male',
    nameFullAr: 'سليمان بن الأشعث السجستاني رحمه الله',
    nameFullId: "Sulayman bin al-Asy'ats as-Sijistani rahimahullah",
    kunyahAr: 'أبو داود',
    birthAh: 202,
    deathAh: 275,
    specialty: ['hadith', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    hadithMin: 4800,
    hadithMax: 5274,
    primaryLocSlug: 'bashrah',
    summaryId:
      'Penyusun Sunan Abi Dawud, kitab hadits yang dikhususkan untuk hadits-hadits ahkam (hukum fiqh).',
  },
  {
    slug: 'imam-at-tirmizi',
    gender: 'male',
    nameFullAr: 'محمد بن عيسى الترمذي رحمه الله',
    nameFullId: 'Muhammad bin Isa at-Tirmizi rahimahullah',
    kunyahAr: 'أبو عيسى',
    birthAh: 209,
    deathAh: 279,
    specialty: ['hadith', 'rijal', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    hadithMin: 3956,
    hadithMax: 3956,
    primaryLocSlug: 'tirmiz',
    summaryId:
      'Penyusun al-Jami\' (Sunan at-Tirmizi); memperkenalkan istilah "hasan" sebagai derajat hadits antara shahih dan dhaif.',
  },
  {
    slug: 'imam-an-nasai',
    gender: 'male',
    nameFullAr: "أحمد بن شعيب النسائي رحمه الله",
    nameFullId: "Ahmad bin Syu'aib an-Nasa'i rahimahullah",
    kunyahAr: 'أبو عبد الرحمن',
    birthAh: 215,
    deathAh: 303,
    specialty: ['hadith', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    hadithMin: 5270,
    hadithMax: 5761,
    summaryId:
      "Penyusun as-Sunan al-Kubra dan al-Mujtaba (as-Sunan as-Sughra); termasuk kitab Kutub Sittah dengan syarat seleksi paling ketat setelah Bukhari-Muslim.",
  },
  {
    slug: 'imam-ibn-majah',
    gender: 'male',
    nameFullAr: 'محمد بن يزيد ابن ماجه القزويني رحمه الله',
    nameFullId: 'Muhammad bin Yazid Ibn Majah al-Qazwini rahimahullah',
    kunyahAr: 'أبو عبد الله',
    birthAh: 209,
    deathAh: 273,
    specialty: ['hadith', 'tafsir'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    hadithMin: 4341,
    hadithMax: 4341,
    summaryId:
      'Penyusun Sunan Ibn Majah, kitab keenam dalam Kutub Sittah; berasal dari Qazwin di wilayah Persia.',
  },

  // ─── Imam besar tabi'ut tabi'in / muhaddits awal ─────────
  {
    slug: 'sufyan-ats-tsauri',
    gender: 'male',
    nameFullAr: 'سفيان بن سعيد الثوري رحمه الله',
    nameFullId: "Sufyan bin Sa'id ats-Tsauri rahimahullah",
    kunyahAr: 'أبو عبد الله',
    laqabId: 'Amirul Mukminin fil Hadits',
    birthAh: 97,
    deathAh: 161,
    specialty: ['hadith', 'fiqh', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'kufah',
    summaryId:
      "Imam ahli hadits dan fiqh dari Kufah; mazhabnya pernah masyhur sebelum kemudian melebur. Dijuluki Amirul Mukminin fil Hadits.",
  },
  {
    slug: 'sufyan-bin-uyaynah',
    gender: 'male',
    nameFullAr: 'سفيان بن عيينة الهلالي رحمه الله',
    nameFullId: 'Sufyan bin Uyaynah al-Hilali rahimahullah',
    kunyahAr: 'أبو محمد',
    birthAh: 107,
    deathAh: 198,
    specialty: ['hadith', 'tafsir', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'makkah',
    summaryId:
      'Imam hadits dan tafsir di Mekkah; guru Imam asy-Syafi\'i, Ahmad bin Hanbal, dan banyak imam besar lain.',
  },
  {
    slug: 'al-awzai',
    gender: 'male',
    nameFullAr: "عبد الرحمن بن عمرو الأوزاعي رحمه الله",
    nameFullId: "Abdurrahman bin Amr al-Awza'i rahimahullah",
    kunyahAr: 'أبو عمرو',
    birthAh: 88,
    deathAh: 157,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'damascus',
    summaryId:
      "Imam ahli fiqh dan hadits di Sham; mazhabnya pernah dominan di Syam dan Andalusia sebelum melebur ke mazhab lain.",
  },
  {
    slug: 'abdullah-bin-mubarak',
    gender: 'male',
    nameFullAr: 'عبد الله بن المبارك المروزي رحمه الله',
    nameFullId: 'Abdullah bin al-Mubarak al-Marwazi rahimahullah',
    kunyahAr: 'أبو عبد الرحمن',
    birthAh: 118,
    deathAh: 181,
    specialty: ['hadith', 'fiqh', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'marw',
    summaryId:
      "Imam Khurasan, penghimpun ilmu dari Timur dan Barat; menulis Kitab az-Zuhd dan Kitab al-Jihad.",
  },
  {
    slug: 'waki-bin-jarrah',
    gender: 'male',
    nameFullAr: "وكيع بن الجراح الرؤاسي رحمه الله",
    nameFullId: "Waki' bin al-Jarrah ar-Ru'asi rahimahullah",
    kunyahAr: 'أبو سفيان',
    birthAh: 129,
    deathAh: 197,
    specialty: ['hadith', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'kufah',
    summaryId:
      "Hafidz hadits Kufah; guru Imam Ahmad bin Hanbal, Yahya bin Ma'in, dan Ali bin al-Madini.",
  },
  {
    slug: 'yahya-bin-said-al-qattan',
    gender: 'male',
    nameFullAr: "يحيى بن سعيد القطان رحمه الله",
    nameFullId: "Yahya bin Sa'id al-Qattan rahimahullah",
    kunyahAr: 'أبو سعيد',
    birthAh: 120,
    deathAh: 198,
    specialty: ['hadith', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'bashrah',
    summaryId:
      "Imam jarh wa ta'dil di Bashrah; salah satu peletak dasar ilmu kritik perawi yang sistematis.",
  },
  {
    slug: 'abdurrahman-bin-mahdi',
    gender: 'male',
    nameFullAr: 'عبد الرحمن بن مهدي رحمه الله',
    nameFullId: 'Abdurrahman bin Mahdi rahimahullah',
    kunyahAr: 'أبو سعيد',
    birthAh: 135,
    deathAh: 198,
    specialty: ['hadith', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'bashrah',
    summaryId:
      "Imam jarh wa ta'dil Bashrah, sahabat dekat Yahya bin Sa'id al-Qattan; rujukan utama Imam Ahmad dalam kritik perawi.",
  },
  {
    slug: 'ali-ibn-al-madini',
    gender: 'male',
    nameFullAr: 'علي بن المديني رحمه الله',
    nameFullId: 'Ali bin al-Madini rahimahullah',
    kunyahAr: 'أبو الحسن',
    birthAh: 161,
    deathAh: 234,
    specialty: ['hadith', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'bashrah',
    summaryId:
      "Guru Imam al-Bukhari dalam ilmu 'ilal hadits; Imam Bukhari berkata: 'Aku tidak merasa kecil di hadapan siapa pun kecuali Ali bin al-Madini.'",
  },
  {
    slug: 'yahya-bin-main',
    gender: 'male',
    nameFullAr: "يحيى بن معين رحمه الله",
    nameFullId: "Yahya bin Ma'in rahimahullah",
    kunyahAr: 'أبو زكريا',
    birthAh: 158,
    deathAh: 233,
    specialty: ['hadith', 'rijal'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'baghdad',
    summaryId:
      "Imam jarh wa ta'dil Baghdad; bersama Ahmad bin Hanbal dan Ali bin al-Madini menjadi rujukan utama kritik perawi pada zamannya.",
  },
  {
    slug: 'ad-darimi',
    gender: 'male',
    nameFullAr: 'عبد الله بن عبد الرحمن الدارمي رحمه الله',
    nameFullId: 'Abdullah bin Abdurrahman ad-Darimi rahimahullah',
    kunyahAr: 'أبو محمد',
    birthAh: 181,
    deathAh: 255,
    specialty: ['hadith', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah_hafidz',
    primaryLocSlug: 'samarkand',
    summaryId:
      "Penyusun Sunan ad-Darimi (juga dikenal Musnad ad-Darimi); guru Imam Muslim, Abu Dawud, dan at-Tirmizi.",
  },

  // ─── Imam Qira'at as-Sab'ah ──────────────────────────────
  {
    slug: 'nafi-al-madani',
    gender: 'male',
    nameFullAr: "نافع بن عبد الرحمن المدني رحمه الله",
    nameFullId: "Nafi' bin Abdurrahman al-Madani rahimahullah",
    kunyahAr: 'أبو رويم',
    deathAh: 169,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'madinah',
    summaryId:
      "Imam qira'at penduduk Madinah; qira'atnya diriwayatkan melalui Qalun dan Warsy, dominan di Maghrib dan sebagian Afrika.",
  },
  {
    slug: 'ibn-katsir-al-makki',
    gender: 'male',
    nameFullAr: "عبد الله بن كثير المكي رحمه الله",
    nameFullId: 'Abdullah bin Katsir al-Makki rahimahullah',
    kunyahAr: 'أبو معبد',
    deathAh: 120,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'makkah',
    summaryId:
      "Imam qira'at penduduk Mekkah; qira'atnya diriwayatkan melalui al-Bazzi dan Qunbul.",
  },
  {
    slug: 'abu-amr-al-bashri',
    gender: 'male',
    nameFullAr: "أبو عمرو بن العلاء البصري رحمه الله",
    nameFullId: "Abu Amr bin al-'Ala al-Bashri rahimahullah",
    kunyahAr: 'أبو عمرو',
    deathAh: 154,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'bashrah',
    summaryId:
      "Imam qira'at penduduk Bashrah; qira'atnya diriwayatkan melalui ad-Duri dan as-Susi.",
  },
  {
    slug: 'ibn-amir-asy-syami',
    gender: 'male',
    nameFullAr: "عبد الله بن عامر الشامي رحمه الله",
    nameFullId: 'Abdullah bin Amir asy-Syami rahimahullah',
    kunyahAr: 'أبو عمران',
    deathAh: 118,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'damascus',
    summaryId:
      "Imam qira'at penduduk Sham; qira'atnya diriwayatkan melalui Hisyam dan Ibn Dzakwan.",
  },
  {
    slug: 'asim-al-kufi',
    gender: 'male',
    nameFullAr: "عاصم بن أبي النجود الكوفي رحمه الله",
    nameFullId: "Ashim bin Abi an-Najud al-Kufi rahimahullah",
    kunyahAr: 'أبو بكر',
    deathAh: 127,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'kufah',
    summaryId:
      "Imam qira'at penduduk Kufah; qira'atnya melalui jalur Hafsh adalah qira'at paling masyhur di dunia Islam saat ini.",
  },
  {
    slug: 'hamzah-az-zayyat',
    gender: 'male',
    nameFullAr: "حمزة بن حبيب الزيات الكوفي رحمه الله",
    nameFullId: 'Hamzah bin Habib az-Zayyat al-Kufi rahimahullah',
    kunyahAr: 'أبو عمارة',
    birthAh: 80,
    deathAh: 156,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'kufah',
    summaryId:
      "Salah satu Imam qira'at sab'ah dari Kufah; qira'atnya diriwayatkan melalui Khalaf dan Khallad.",
  },
  {
    slug: 'al-kisai',
    gender: 'male',
    nameFullAr: "علي بن حمزة الكسائي رحمه الله",
    nameFullId: "Ali bin Hamzah al-Kisa'i rahimahullah",
    kunyahAr: 'أبو الحسن',
    birthAh: 119,
    deathAh: 189,
    specialty: ['qira-ah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'kufah',
    summaryId:
      "Imam qira'at sekaligus imam ahli nahwu Kufah; qira'atnya diriwayatkan melalui Abu al-Harits dan ad-Duri.",
  },

  // ─── Tabi'at-tabi'iyyat (female) ──────────────────────────
  {
    slug: 'nafisah-binti-hasan',
    gender: 'female',
    nameFullAr: 'نفيسة بنت الحسن بن زيد رحمها الله',
    nameFullId: 'Nafisah binti al-Hasan bin Zaid rahimahallah',
    laqabId: "Nafisah al-'Ilm wal-Ma'rifah",
    birthAh: 145,
    deathAh: 208,
    specialty: ['hadith', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    primaryLocSlug: 'cairo',
    summaryId:
      "Wanita shalihah keturunan Ahlul Bait, dikenal sebagai ahli ibadah dan ilmu di Mesir; Imam asy-Syafi'i sempat menghadiri majelisnya.",
  },
  {
    slug: 'rabiah-al-adawiyyah',
    gender: 'female',
    nameFullAr: "رابعة العدوية البصرية رحمها الله",
    nameFullId: "Rabi'ah al-'Adawiyyah al-Bashriyyah rahimahallah",
    laqabId: 'Al-Qudwah az-Zahidah',
    birthAh: 95,
    deathAh: 185,
    specialty: ['ibadah'],
    madhab: 'no_madhab',
    rijalGrade: 'unverified',
    primaryLocSlug: 'bashrah',
    summaryId:
      "Tokoh zuhud wanita dari Bashrah; banyak riwayat tentangnya beredar di sumber-sumber tasawuf dengan derajat kesahihan yang berbeda-beda.",
  },
]

export async function seed024TabiutTabiin(): Promise<void> {
  const db = getSeedDb()
  const cats = await db.select().from(figureCategories)
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]))
  const categoryId = catBySlug.get('tabiut_tabiin')
  if (!categoryId) {
    console.warn('  ⚠ category tabiut_tabiin not found — run 007_figure_categories first')
    return
  }
  const locs = await db.select().from(locations)
  const locBySlug = new Map(locs.map((l) => [l.slug, l.id]))

  let total = 0
  for (const f of FIGURES) {
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
        deathDateAh: f.deathAh,
        specialty: f.specialty,
        madhab: f.madhab,
        rijalGrade: f.rijalGrade,
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
  logSeed('tabiut_tabiin', total)
}
