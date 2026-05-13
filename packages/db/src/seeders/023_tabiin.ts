// Seeder: Tabi'in (murid sahabat) — generasi setelah sahabat.
// Pattern mengikuti 017_demo_figures.ts. Mazhab formal belum eksis di era ini,
// sehingga sebagian besar entry diberi 'no_madhab'.

import { getSeedDb, logSeed } from './_helpers.js'
import { figures, figureCategories } from '../schema/index.js'

type Madhab = 'shafii' | 'maliki' | 'hanafi' | 'hanbali' | 'zhahiri' | 'no_madhab'
type RijalGrade = 'sahabi_udul' | 'thiqah_thiqah' | 'thiqah_hafidz' | 'thiqah' | 'saduq'

type FigureSeed = {
  slug: string
  gender: 'male' | 'female'
  nameFullAr: string
  nameFullId: string
  kunyahAr?: string
  kunyahId?: string
  laqabId?: string
  birthAh?: number
  birthCe?: number
  deathAh?: number
  deathCe?: number
  specialty?: string[]
  madhab?: Madhab
  rijalGrade?: RijalGrade
  summaryId: string
}

const FIGURES: FigureSeed[] = [
  // ─── 7 Fuqaha Madinah ─────────────────────────────────────
  {
    slug: 'said-bin-musayyab',
    gender: 'male',
    nameFullAr: 'سَعِيد بْن الْمُسَيَّب رحمه الله',
    nameFullId: 'Sa’id bin al-Musayyab rahimahullah',
    kunyahAr: 'أبو محمد',
    kunyahId: 'Abu Muhammad',
    laqabId: 'Sayyid at-Tabi’in',
    birthAh: 13,
    birthCe: 634,
    deathAh: 94,
    deathCe: 713,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; sayyid at-tabi’in dan murid besar para sahabat seperti Umar dan Abu Hurairah rahimahullah.',
  },
  {
    slug: 'urwah-bin-zubair',
    gender: 'male',
    nameFullAr: 'عُرْوَة بْن الزُّبَيْر رحمه الله',
    nameFullId: 'Urwah bin Zubair rahimahullah',
    kunyahAr: 'أبو عبد الله',
    kunyahId: 'Abu Abdillah',
    birthAh: 23,
    birthCe: 644,
    deathAh: 94,
    deathCe: 713,
    specialty: ['fiqh', 'hadith', 'sirah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; putra Zubair bin Awwam dan keponakan Aisyah; pelopor penulisan sirah Nabi rahimahullah.',
  },
  {
    slug: 'al-qasim-bin-muhammad',
    gender: 'male',
    nameFullAr: 'الْقَاسِم بْن مُحَمَّد بْن أَبِي بَكْر رحمه الله',
    nameFullId: 'al-Qasim bin Muhammad bin Abi Bakr rahimahullah',
    kunyahAr: 'أبو محمد',
    kunyahId: 'Abu Muhammad',
    birthAh: 37,
    birthCe: 657,
    deathAh: 107,
    deathCe: 725,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; cucu Abu Bakr ash-Shiddiq dan murid bibinya Aisyah rahimahullah.',
  },
  {
    slug: 'kharijah-bin-zaid',
    gender: 'male',
    nameFullAr: 'خَارِجَة بْن زَيْد بْن ثَابِت رحمه الله',
    nameFullId: 'Kharijah bin Zaid bin Tsabit rahimahullah',
    kunyahAr: 'أبو زيد',
    kunyahId: 'Abu Zaid',
    deathAh: 99,
    deathCe: 717,
    specialty: ['fiqh', 'faraidh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; putra Zaid bin Tsabit, ahli faraidh dan fatwa di Madinah rahimahullah.',
  },
  {
    slug: 'abu-bakr-bin-abdurrahman-bin-harits',
    gender: 'male',
    nameFullAr: 'أَبُو بَكْر بْن عَبْد الرَّحْمَن بْن الْحَارِث رحمه الله',
    nameFullId: 'Abu Bakr bin Abdurrahman bin Harits rahimahullah',
    kunyahAr: 'أبو بكر',
    kunyahId: 'Abu Bakr',
    deathAh: 94,
    deathCe: 713,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; dikenal banyak shalat malam dan ibadah hingga dijuluki rahib Quraisy rahimahullah.',
  },
  {
    slug: 'sulayman-bin-yasar',
    gender: 'male',
    nameFullAr: 'سُلَيْمَان بْن يَسَار رحمه الله',
    nameFullId: 'Sulayman bin Yasar rahimahullah',
    kunyahAr: 'أبو أيوب',
    kunyahId: 'Abu Ayyub',
    deathAh: 107,
    deathCe: 725,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; mawla Maimunah Ummul Mukminin dan saudara Atha’ bin Yasar rahimahullah.',
  },
  {
    slug: 'ubaidullah-bin-abdullah-bin-utbah',
    gender: 'male',
    nameFullAr: 'عُبَيْد الله بْن عَبْد الله بْن عُتْبَة رحمه الله',
    nameFullId: 'Ubaidullah bin Abdullah bin Utbah rahimahullah',
    kunyahAr: 'أبو عبد الله',
    kunyahId: 'Abu Abdillah',
    deathAh: 99,
    deathCe: 717,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Salah satu Fuqaha Sab’ah Madinah; guru Umar bin Abdul Aziz dan az-Zuhri rahimahullah.',
  },

  // ─── Tabi'in besar lainnya ────────────────────────────────
  {
    slug: 'hasan-al-bashri',
    gender: 'male',
    nameFullAr: 'الْحَسَن الْبَصْرِي رحمه الله',
    nameFullId: 'Hasan al-Bashri rahimahullah',
    kunyahAr: 'أبو سعيد',
    kunyahId: 'Abu Sa’id',
    birthAh: 21,
    birthCe: 642,
    deathAh: 110,
    deathCe: 728,
    specialty: ['fiqh', 'hadith', 'tafsir', 'zuhd'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Imam tabi’in di Bashrah; ulama, zahid, dan ahli nasihat yang masyhur kefasihannya rahimahullah.',
  },
  {
    slug: 'muhammad-bin-sirin',
    gender: 'male',
    nameFullAr: 'مُحَمَّد بْن سِيرِين رحمه الله',
    nameFullId: 'Muhammad bin Sirin rahimahullah',
    kunyahAr: 'أبو بكر',
    kunyahId: 'Abu Bakr',
    birthAh: 33,
    birthCe: 653,
    deathAh: 110,
    deathCe: 728,
    specialty: ['fiqh', 'hadith', 'tafsir_ru-ya'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in besar di Bashrah; ahli fiqh dan dikenal sebagai mufassir mimpi (ta’bir ru’ya) rahimahullah.',
  },
  {
    slug: 'ata-bin-abi-rabah',
    gender: 'male',
    nameFullAr: 'عَطَاء بْن أَبِي رَبَاح رحمه الله',
    nameFullId: 'Atha’ bin Abi Rabah rahimahullah',
    kunyahAr: 'أبو محمد',
    kunyahId: 'Abu Muhammad',
    deathAh: 114,
    deathCe: 732,
    specialty: ['fiqh', 'hadith', 'manasik'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Mufti Mekkah pada masanya; rujukan utama dalam fatwa haji dan manasik rahimahullah.',
  },
  {
    slug: 'mujahid-bin-jabr',
    gender: 'male',
    nameFullAr: 'مُجَاهِد بْن جَبْر رحمه الله',
    nameFullId: 'Mujahid bin Jabr rahimahullah',
    kunyahAr: 'أبو الحجاج',
    kunyahId: 'Abu al-Hajjaj',
    birthAh: 21,
    birthCe: 642,
    deathAh: 102,
    deathCe: 720,
    specialty: ['tafsir', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in ahli tafsir; murid Ibn Abbas yang membacakan mushaf kepadanya tiga kali untuk menanyakan setiap ayat rahimahullah.',
  },
  {
    slug: 'tawus-bin-kaysan',
    gender: 'male',
    nameFullAr: 'طَاوُس بْن كَيْسَان رحمه الله',
    nameFullId: 'Tawus bin Kaysan rahimahullah',
    kunyahAr: 'أبو عبد الرحمن',
    kunyahId: 'Abu Abdurrahman',
    deathAh: 106,
    deathCe: 724,
    specialty: ['fiqh', 'hadith', 'tafsir'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in besar di Yaman; murid Ibn Abbas dan termasuk imam zuhd di masanya rahimahullah.',
  },
  {
    slug: 'ikrimah-mawla-ibn-abbas',
    gender: 'male',
    nameFullAr: 'عِكْرِمَة مَوْلَى ابْن عَبَّاس رحمه الله',
    nameFullId: 'Ikrimah mawla Ibn Abbas rahimahullah',
    kunyahAr: 'أبو عبد الله',
    kunyahId: 'Abu Abdillah',
    deathAh: 105,
    deathCe: 723,
    specialty: ['tafsir', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Mawla Ibn Abbas; perawi dan mufassir besar yang banyak meriwayatkan tafsir Quran dari gurunya rahimahullah.',
  },
  {
    slug: 'az-zuhri',
    gender: 'male',
    nameFullAr: 'مُحَمَّد بْن مُسْلِم بْن شِهَاب الزُّهْرِي رحمه الله',
    nameFullId: 'Muhammad bin Muslim bin Syihab az-Zuhri rahimahullah',
    kunyahAr: 'أبو بكر',
    kunyahId: 'Abu Bakr',
    birthAh: 50,
    birthCe: 670,
    deathAh: 124,
    deathCe: 742,
    specialty: ['hadith', 'fiqh', 'maghazi'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Imam ahli hadits dan maghazi; dijuluki "imam fi maghazi"; pelopor kodifikasi hadits di masa Umar bin Abdul Aziz rahimahullah.',
  },
  {
    slug: 'ibrahim-an-nakhai',
    gender: 'male',
    nameFullAr: 'إِبْرَاهِيم بْن يَزِيد النَّخَعِي رحمه الله',
    nameFullId: 'Ibrahim bin Yazid an-Nakha’i rahimahullah',
    kunyahAr: 'أبو عمران',
    kunyahId: 'Abu Imran',
    deathAh: 96,
    deathCe: 714,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Ahli fiqh Kufah dari kalangan tabi’in; gurunya Hammad bin Abi Sulaiman yang kelak menjadi guru Abu Hanifah rahimahullah.',
  },
  {
    slug: 'aamir-as-syabi',
    gender: 'male',
    nameFullAr: 'عَامِر بْن شَرَاحِيل الشَّعْبِي رحمه الله',
    nameFullId: 'Amir bin Syarahil asy-Sya’bi rahimahullah',
    kunyahAr: 'أبو عمرو',
    kunyahId: 'Abu Amr',
    deathAh: 104,
    deathCe: 722,
    specialty: ['fiqh', 'hadith', 'qadha'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in besar di Kufah; faqih dan qadhi yang menjumpai sekitar 500 sahabat rahimahullah.',
  },
  {
    slug: 'qatadah-bin-diamah',
    gender: 'male',
    nameFullAr: 'قَتَادَة بْن دِعَامَة السَّدُوسِي رحمه الله',
    nameFullId: 'Qatadah bin Di’amah as-Sadusi rahimahullah',
    kunyahAr: 'أبو الخطاب',
    kunyahId: 'Abu al-Khattab',
    deathAh: 117,
    deathCe: 735,
    specialty: ['tafsir', 'hadith', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in besar di Bashrah; mufassir dan ahli hadits yang masyhur kuat hafalannya rahimahullah.',
  },
  {
    slug: 'nafi-mawla-ibn-umar',
    gender: 'male',
    nameFullAr: 'نَافِع مَوْلَى ابْن عُمَر رحمه الله',
    nameFullId: 'Nafi’ mawla Ibn Umar rahimahullah',
    kunyahAr: 'أبو عبد الله',
    kunyahId: 'Abu Abdillah',
    deathAh: 117,
    deathCe: 735,
    specialty: ['hadith', 'fiqh'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Mawla Ibn Umar; salah satu sanad emas (silsilah dzahab) hadits ketika diriwayatkan Malik darinya, dari Ibn Umar rahimahullah.',
  },
  {
    slug: 'salim-bin-abdullah-bin-umar',
    gender: 'male',
    nameFullAr: 'سَالِم بْن عَبْد الله بْن عُمَر رحمه الله',
    nameFullId: 'Salim bin Abdullah bin Umar rahimahullah',
    kunyahAr: 'أبو عمر',
    kunyahId: 'Abu Umar',
    deathAh: 106,
    deathCe: 724,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Cucu Umar bin Khattab dan tabi’in besar di Madinah; salah satu ahli fiqh keluarga Umar rahimahullah.',
  },
  {
    slug: 'umar-bin-abdul-aziz',
    gender: 'male',
    nameFullAr: 'عُمَر بْن عَبْد الْعَزِيز رحمه الله',
    nameFullId: 'Umar bin Abdul Aziz rahimahullah',
    kunyahAr: 'أبو حفص',
    kunyahId: 'Abu Hafsh',
    laqabId: 'Khalifah ar-Rasyid kelima',
    birthAh: 61,
    birthCe: 681,
    deathAh: 101,
    deathCe: 720,
    specialty: ['fiqh', 'hadith', 'siyasah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Khalifah Bani Umayyah yang dijuluki khalifah ar-rasyid kelima; memerintahkan kodifikasi hadits secara resmi rahimahullah.',
  },
  {
    slug: 'said-bin-jubayr',
    gender: 'male',
    nameFullAr: 'سَعِيد بْن جُبَيْر رحمه الله',
    nameFullId: 'Sa’id bin Jubayr rahimahullah',
    kunyahAr: 'أبو عبد الله',
    kunyahId: 'Abu Abdillah',
    deathAh: 95,
    deathCe: 714,
    specialty: ['tafsir', 'fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in mufassir murid Ibn Abbas; syahid dibunuh al-Hajjaj bin Yusuf pada tahun 95 H rahimahullah.',
  },
  {
    slug: 'wahb-bin-munabbih',
    gender: 'male',
    nameFullAr: 'وَهْب بْن مُنَبِّه رحمه الله',
    nameFullId: 'Wahb bin Munabbih rahimahullah',
    kunyahAr: 'أبو عبد الله',
    kunyahId: 'Abu Abdillah',
    deathAh: 110,
    deathCe: 728,
    specialty: ['tarikh', 'qashash', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in dari Yaman; ahli kisah para nabi terdahulu dan tarikh umat sebelum Islam rahimahullah.',
  },
  {
    slug: 'aban-bin-utsman',
    gender: 'male',
    nameFullAr: 'أَبَان بْن عُثْمَان بْن عَفَّان رحمه الله',
    nameFullId: 'Aban bin Utsman bin Affan rahimahullah',
    kunyahAr: 'أبو سعيد',
    kunyahId: 'Abu Sa’id',
    deathAh: 105,
    deathCe: 723,
    specialty: ['fiqh', 'hadith', 'sirah'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Putra Khalifah Utsman bin Affan; tabi’in dan wali Madinah pada masa Bani Umayyah rahimahullah.',
  },
  {
    slug: 'rabia-ar-rai',
    gender: 'male',
    nameFullAr: 'رَبِيعَة بْن عَبْد الرَّحْمَن (رَبِيعَة الرَّأْي) رحمه الله',
    nameFullId: 'Rabi’ah bin Abdurrahman (Rabi’ah ar-Ra’y) rahimahullah',
    kunyahAr: 'أبو عثمان',
    kunyahId: 'Abu Utsman',
    deathAh: 136,
    deathCe: 753,
    specialty: ['fiqh', 'hadith', 'ra-y'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Faqih Madinah yang dijuluki Rabi’ah ar-Ra’y; guru utama Imam Malik dalam fiqh rahimahullah.',
  },
  {
    slug: 'maymun-bin-mihran',
    gender: 'male',
    nameFullAr: 'مَيْمُون بْن مِهْرَان رحمه الله',
    nameFullId: 'Maymun bin Mihran rahimahullah',
    kunyahAr: 'أبو أيوب',
    kunyahId: 'Abu Ayyub',
    deathAh: 117,
    deathCe: 735,
    specialty: ['fiqh', 'hadith', 'qadha'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in dan qadhi al-Jazirah; rujukan fatwa Umar bin Abdul Aziz di wilayah tersebut rahimahullah.',
  },
  {
    slug: 'ubaidah-as-salmani',
    gender: 'male',
    nameFullAr: 'عَبِيدَة السَّلْمَانِي رحمه الله',
    nameFullId: 'Ubaidah as-Salmani rahimahullah',
    kunyahAr: 'أبو عمرو',
    kunyahId: 'Abu Amr',
    deathAh: 72,
    deathCe: 691,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in besar di Kufah; murid Ali bin Abi Thalib dan Ibn Mas’ud serta rujukan fatwa di masanya rahimahullah.',
  },
  {
    slug: 'aswad-bin-yazid',
    gender: 'male',
    nameFullAr: 'الْأَسْوَد بْن يَزِيد النَّخَعِي رحمه الله',
    nameFullId: 'Aswad bin Yazid an-Nakha’i rahimahullah',
    kunyahAr: 'أبو عمرو',
    kunyahId: 'Abu Amr',
    deathAh: 75,
    deathCe: 694,
    specialty: ['fiqh', 'hadith', 'qira-at'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’in besar di Kufah; murid Ibn Mas’ud, ahli ibadah dan masyhur banyak puasa serta shalat malam rahimahullah.',
  },

  // ─── Tabi'iyyat (female) ──────────────────────────────────
  {
    slug: 'aisyah-binti-thalhah',
    gender: 'female',
    nameFullAr: 'عَائِشَة بِنْت طَلْحَة رحمها الله',
    nameFullId: 'Aisyah binti Thalhah rahimahallah',
    deathAh: 110,
    deathCe: 728,
    specialty: ['hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Putri sahabat Thalhah bin Ubaidillah dan keponakan Aisyah Ummul Mukminin; meriwayatkan hadits dari bibinya rahimahallah.',
  },
  {
    slug: 'amrah-binti-abdurrahman',
    gender: 'female',
    nameFullAr: 'عَمْرَة بِنْت عَبْد الرَّحْمَن الْأَنْصَارِيَّة رحمها الله',
    nameFullId: 'Amrah binti Abdurrahman al-Anshariyyah rahimahallah',
    deathAh: 98,
    deathCe: 716,
    specialty: ['fiqh', 'hadith'],
    madhab: 'no_madhab',
    rijalGrade: 'thiqah',
    summaryId:
      'Tabi’iyyah faqihah di Madinah; murid Aisyah Ummul Mukminin dan rujukan riwayat darinya rahimahallah.',
  },
]

export async function seed023Tabiin() {
  const db = getSeedDb()
  const cats = await db.select().from(figureCategories)
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]))
  const categoryId = catBySlug.get('tabiin')
  if (!categoryId) {
    logSeed('tabiin', 0, 'skipped (category missing)')
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
        kunyahAr: f.kunyahAr,
        kunyahId: f.kunyahId,
        laqabId: f.laqabId,
        birthDateAh: f.birthAh,
        birthDateCe: f.birthCe,
        deathDateAh: f.deathAh,
        deathDateCe: f.deathCe,
        deathDatePrecision: 'year',
        specialty: f.specialty,
        madhab: f.madhab,
        rijalGrade: f.rijalGrade ?? 'thiqah',
        summaryId: f.summaryId,
        status: 'published',
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    if (result.length > 0) total++
  }
  logSeed('tabiin', total)
}
