// Seed ~15 ghazwah / futuhat battles. Idempotent via onConflictDoNothing.
// Run with: pnpm db:seed:dev

import { getSeedDb, logSeed } from './_helpers.js'
import { battles, locations, figures } from '../schema/index.js'

type BattleType = 'ghazwah' | 'sariyyah' | 'futuhat'
type BattleOutcome = 'victory' | 'defeat' | 'truce' | 'partial'
type DatePrecision = 'year' | 'month' | 'day' | 'approximate' | 'range'

type BattleSeed = {
  slug: string
  nameAr: string
  nameId: string
  type: BattleType
  eventDateAh?: number
  eventDateCe?: number
  eventDatePrecision?: DatePrecision
  eventDateNotes?: string
  locationSlug?: string
  commanderSlug?: string
  opponentForce?: string
  muslimCount?: number
  opponentCount?: number
  outcome?: BattleOutcome
  casualtiesMuslim?: number
  casualtiesOpponent?: number
  strategyId?: string
  narrativeId?: string
  significanceId?: string
}

const BATTLES: BattleSeed[] = [
  // ─── Ghazwah (Nabi ﷺ hadir) ───────────────────────────────
  {
    slug: 'ghazwah-badar',
    nameAr: 'غزوة بدر الكبرى',
    nameId: 'Perang Badar Kubra',
    type: 'ghazwah',
    eventDateAh: 2,
    eventDateCe: 624,
    eventDatePrecision: 'month',
    eventDateNotes: '17 Ramadhan 2 H',
    locationSlug: 'badr',
    opponentForce: 'Quraisy Makkah',
    muslimCount: 313,
    opponentCount: 1000,
    outcome: 'victory',
    casualtiesMuslim: 14,
    casualtiesOpponent: 70,
    strategyId:
      'Pasukan kecil Muslim menguasai sumber air Badar lebih dulu lalu menyerang dengan formasi rapat.',
    narrativeId:
      'Pertempuran pertama Muslim melawan Quraisy. 313 sahabat mengalahkan kafilah dan pasukan Quraisy yang berjumlah ~1000 orang; ~70 tawanan diambil.',
    significanceId:
      'Yawmul Furqan — pembeda antara haq dan batil; tonggak awal kekuatan Islam di Madinah.',
  },
  {
    slug: 'ghazwah-uhud',
    nameAr: 'غزوة أحد',
    nameId: 'Perang Uhud',
    type: 'ghazwah',
    eventDateAh: 3,
    eventDateCe: 625,
    eventDatePrecision: 'month',
    eventDateNotes: '7 Syawwal 3 H',
    locationSlug: 'uhud',
    opponentForce: 'Quraisy Makkah',
    muslimCount: 700,
    opponentCount: 3000,
    outcome: 'partial',
    casualtiesMuslim: 70,
    strategyId:
      'Nabi ﷺ menempatkan pemanah di bukit Ainain; ketika mereka turun mengejar ghanimah, kavaleri Khalid bin Walid menyerang dari belakang.',
    narrativeId:
      'Kemenangan awal berubah menjadi kekalahan parsial setelah pemanah meninggalkan posisi. Hamzah bin Abdil Muthalib syahid bersama 70 sahabat.',
    significanceId:
      'Pelajaran taat pada perintah pemimpin; ujian iman dan kesabaran bagi kaum Muslimin.',
  },
  {
    slug: 'ghazwah-khandaq',
    nameAr: 'غزوة الخندق',
    nameId: 'Perang Khandaq (Ahzab)',
    type: 'ghazwah',
    eventDateAh: 5,
    eventDateCe: 627,
    eventDatePrecision: 'month',
    eventDateNotes: 'Syawwal 5 H',
    locationSlug: 'madinah',
    opponentForce: 'Konfederasi Ahzab (Quraisy, Ghathafan, Yahudi)',
    muslimCount: 3000,
    opponentCount: 10000,
    outcome: 'victory',
    strategyId:
      'Atas usul Salman al-Farisi, Muslim menggali parit (khandaq) di sisi utara Madinah yang terbuka, menutup jalur kavaleri musuh.',
    narrativeId:
      'Pengepungan ~1 bulan tanpa pertempuran besar; angin dingin dan kelaparan memaksa Ahzab mundur.',
    significanceId:
      'Akhir era ofensif Quraisy terhadap Madinah; Nabi ﷺ bersabda: "Sekarang kita yang akan menyerang mereka."',
  },
  {
    slug: 'ghazwah-bani-quraidzah',
    nameAr: 'غزوة بني قريظة',
    nameId: 'Perang Bani Quraydhah',
    type: 'ghazwah',
    eventDateAh: 5,
    eventDateCe: 627,
    eventDatePrecision: 'month',
    eventDateNotes: 'Dzulqa\'dah 5 H, segera setelah Khandaq',
    locationSlug: 'madinah',
    opponentForce: 'Yahudi Bani Quraydhah',
    outcome: 'victory',
    strategyId:
      'Pengepungan benteng Bani Quraydhah selama ~25 hari hingga mereka menyerah dan menerima hukum Sa\'ad bin Mu\'adz.',
    narrativeId:
      'Pengkhianatan Bani Quraydhah saat Khandaq dijatuhi hukuman sesuai Taurat: laki-laki dewasa dihukum mati, sisanya ditawan.',
    significanceId:
      'Mengakhiri ancaman internal Yahudi di Madinah; menegakkan supremasi negara Islam.',
  },
  {
    slug: 'ghazwah-bani-mushtaliq',
    nameAr: 'غزوة بني المصطلق',
    nameId: 'Perang Bani Mushtaliq (Muraisi\')',
    type: 'ghazwah',
    eventDateAh: 5,
    eventDateCe: 627,
    eventDatePrecision: 'year',
    opponentForce: 'Bani Mushtaliq (Khuza\'ah)',
    outcome: 'victory',
    strategyId:
      'Serangan kilat ke perkampungan Bani Mushtaliq di sumber air Muraisi\' sebelum mereka sempat berhimpun.',
    narrativeId:
      'Muslim menang dengan korban minimal; di antara tawanan adalah Juwairiyah binti al-Harits yang kemudian dinikahi Nabi ﷺ.',
    significanceId:
      'Peristiwa hadits ifk terjadi sepulang dari perang ini; turun ayat tabarruj dan munafiqun.',
  },
  {
    slug: 'ghazwah-hudaibiyyah',
    nameAr: 'غزوة الحديبية',
    nameId: 'Peristiwa Hudaibiyyah',
    type: 'ghazwah',
    eventDateAh: 6,
    eventDateCe: 628,
    eventDatePrecision: 'month',
    eventDateNotes: 'Dzulqa\'dah 6 H',
    locationSlug: 'hudaybiyyah',
    opponentForce: 'Quraisy Makkah',
    muslimCount: 1400,
    outcome: 'truce',
    strategyId:
      'Nabi ﷺ menempuh jalan diplomasi: berihram untuk umrah, tetap di Hudaibiyyah, dan menerima syarat-syarat Quraisy demi gencatan senjata 10 tahun.',
    narrativeId:
      'Bai\'at Ridhwan di bawah pohon; perjanjian damai meskipun dianggap berat oleh sebagian sahabat.',
    significanceId:
      'Allah menyebutnya "fath mubin" (QS al-Fath). Membuka pintu dakwah dan jumlah Muslim melonjak menjelang Fath Makkah.',
  },
  {
    slug: 'ghazwah-khaibar',
    nameAr: 'غزوة خيبر',
    nameId: 'Perang Khaibar',
    type: 'ghazwah',
    eventDateAh: 7,
    eventDateCe: 628,
    eventDatePrecision: 'month',
    eventDateNotes: 'Muharram 7 H',
    locationSlug: 'khaybar',
    opponentForce: 'Yahudi Khaibar',
    muslimCount: 1500,
    outcome: 'victory',
    strategyId:
      'Pengepungan benteng-benteng Khaibar satu per satu; benteng terakhir (Qamus) dibuka oleh Ali bin Abi Thalib.',
    narrativeId:
      'Nabi ﷺ bersabda: "Akan kuserahkan panji ini esok kepada orang yang Allah menangkan lewat tangannya." Ali ra membuka benteng Qamus.',
    significanceId:
      'Mengakhiri kekuatan Yahudi di Hijaz utara; pertama kali tanah taklukan dikelola sebagai tanah kharaj.',
  },
  {
    slug: 'ghazwah-mutah',
    nameAr: 'غزوة مؤتة',
    nameId: 'Perang Mu\'tah',
    type: 'ghazwah',
    eventDateAh: 8,
    eventDateCe: 629,
    eventDatePrecision: 'month',
    eventDateNotes: 'Jumadal Ula 8 H',
    locationSlug: 'mutah',
    opponentForce: 'Romawi (Bizantium) & Ghassaniyyah',
    muslimCount: 3000,
    opponentCount: 100000,
    outcome: 'partial',
    strategyId:
      'Khalid bin Walid mengambil alih komando setelah 3 panglima syahid, lalu menarik mundur pasukan dengan tipu daya bertukar barisan.',
    narrativeId:
      'Tiga panglima syahid berurutan: Zayd bin Haritsah, Ja\'far bin Abi Thalib, lalu Abdullah bin Rawahah. Khalid menyelamatkan pasukan Muslim.',
    significanceId:
      'Konfrontasi pertama dengan Romawi; Khalid mendapat gelar "Saifullah al-Maslul" — pintu jihad melawan Romawi terbuka.',
  },
  {
    slug: 'fath-makkah',
    nameAr: 'فتح مكة',
    nameId: 'Pembebasan Makkah',
    type: 'ghazwah',
    eventDateAh: 8,
    eventDateCe: 630,
    eventDatePrecision: 'month',
    eventDateNotes: 'Ramadhan 8 H',
    locationSlug: 'makkah',
    opponentForce: 'Quraisy Makkah',
    muslimCount: 10000,
    outcome: 'victory',
    strategyId:
      'Nabi ﷺ membagi pasukan dalam 4 kolom memasuki Makkah dari arah berbeda; perintah tegas larangan bertempur kecuali yang melawan.',
    narrativeId:
      'Makkah dibebaskan hampir tanpa pertempuran setelah Quraisy melanggar perjanjian Hudaibiyyah. Berhala-berhala Ka\'bah dihancurkan; amnesti umum diberikan.',
    significanceId:
      'Hari kemenangan terbesar Islam; turun surat an-Nashr. Quraisy memeluk Islam berbondong-bondong.',
  },
  {
    slug: 'ghazwah-hunain',
    nameAr: 'غزوة حنين',
    nameId: 'Perang Hunain',
    type: 'ghazwah',
    eventDateAh: 8,
    eventDateCe: 630,
    eventDatePrecision: 'month',
    eventDateNotes: 'Syawwal 8 H, segera setelah Fath Makkah',
    opponentForce: 'Hawazin & Tsaqif',
    muslimCount: 12000,
    outcome: 'victory',
    strategyId:
      'Setelah serangan mendadak pemanah Hawazin di lembah Hunain, Nabi ﷺ mengumpulkan kembali pasukan di sekitarnya dan membalikkan pertempuran.',
    narrativeId:
      'Pasukan Muslim sempat berlarian karena terkejut, lalu Nabi ﷺ menyeru "Aku Nabi tanpa dusta, aku putra Abdul Muthalib." Mereka pun kembali dan menang.',
    significanceId:
      'Pelajaran al-Quran tentang larangan ujub karena banyaknya jumlah (QS at-Taubah:25); ghanimah besar dibagi pasca Tha\'if.',
  },
  {
    slug: 'ghazwah-tabuk',
    nameAr: 'غزوة تبوك',
    nameId: 'Perang Tabuk',
    type: 'ghazwah',
    eventDateAh: 9,
    eventDateCe: 630,
    eventDatePrecision: 'month',
    eventDateNotes: 'Rajab 9 H',
    locationSlug: 'tabuk',
    opponentForce: 'Romawi (Bizantium)',
    muslimCount: 30000,
    outcome: 'truce',
    strategyId:
      'Ekspedisi besar di musim panas (jaysy al-\'usrah) ke perbatasan Romawi untuk menggertak; menetap ~20 hari di Tabuk tanpa bertemu musuh.',
    narrativeId:
      'Romawi tidak menampakkan diri; Nabi ﷺ mengikat perjanjian dengan penguasa-penguasa kecil sekitar Tabuk (Aylah, Jarba\', Adzruh).',
    significanceId:
      'Ghazwah terakhir Nabi ﷺ; ujian keikhlasan ummat — peristiwa 3 sahabat yang tertinggal (Ka\'ab bin Malik dkk) diabadikan dalam QS at-Taubah.',
  },

  // ─── Futuhat awal (pasca-wafat Nabi ﷺ) ────────────────────
  {
    slug: 'pertempuran-yarmuk',
    nameAr: 'معركة اليرموك',
    nameId: 'Pertempuran Yarmuk',
    type: 'futuhat',
    eventDateAh: 15,
    eventDateCe: 636,
    eventDatePrecision: 'month',
    eventDateNotes: 'Rajab 15 H',
    locationSlug: 'yarmuk',
    commanderSlug: 'khalid-bin-walid',
    opponentForce: 'Romawi (Bizantium) Heraclius',
    muslimCount: 36000,
    opponentCount: 150000,
    outcome: 'victory',
    strategyId:
      'Khalid bin Walid menyusun pasukan dalam 36 karadis kecil yang lincah; memanfaatkan medan ngarai Yarmuk untuk menjebak Romawi.',
    narrativeId:
      'Pertempuran 6 hari berakhir dengan kehancuran total pasukan Romawi. Komandan-komandan besar: Abu Ubaidah, Khalid, \'Amr bin al-\'Ash, Yazid bin Abi Sufyan, Syurahbil.',
    significanceId:
      'Mengakhiri kekuasaan Bizantium atas Sham (Suriah); Heraclius mundur ke Konstantinopel dan mengucap selamat tinggal pada Sham.',
  },
  {
    slug: 'pertempuran-qadisiyyah',
    nameAr: 'معركة القادسية',
    nameId: 'Pertempuran Qadisiyyah',
    type: 'futuhat',
    eventDateAh: 14,
    eventDateCe: 636,
    eventDatePrecision: 'month',
    eventDateNotes: 'Sya\'ban 14 H (riwayat lain 15 H)',
    locationSlug: 'qadisiyyah',
    commanderSlug: 'saad-bin-abi-waqqash',
    opponentForce: 'Sasaniyah Persia (Rustam Farrukhzad)',
    muslimCount: 30000,
    opponentCount: 120000,
    outcome: 'victory',
    strategyId:
      'Sa\'ad bin Abi Waqqash memimpin dari atas benteng karena sakit; pasukan dibagi 4 hari pertempuran berturut: Armats, Aghwats, \'Imas, Qadisiyyah.',
    narrativeId:
      'Pertempuran berakhir dengan terbunuhnya panglima Persia Rustam dan tertawanya panji Kisra "Dirafsy-e Kawiyani".',
    significanceId:
      'Pintu masuk runtuhnya Imperium Sasaniyah; jalan ke Madain (Ctesiphon) ibukota Persia terbuka.',
  },
  {
    slug: 'pertempuran-nahawand',
    nameAr: 'معركة نهاوند',
    nameId: 'Pertempuran Nahawand',
    type: 'futuhat',
    eventDateAh: 21,
    eventDateCe: 642,
    eventDatePrecision: 'year',
    locationSlug: 'nahawand',
    opponentForce: 'Sasaniyah Persia (Yazdgerd III)',
    muslimCount: 30000,
    opponentCount: 150000,
    outcome: 'victory',
    strategyId:
      'An-Nu\'man bin Muqarrin memerintahkan pasukan berpura-pura mundur untuk memancing Persia keluar dari benteng, lalu menyerang balik.',
    narrativeId:
      'An-Nu\'man syahid di awal pertempuran; bendera diambil oleh Hudzaifah bin al-Yaman dan kemenangan diraih. Yazdgerd III melarikan diri.',
    significanceId:
      '"Fath al-Futuh" — akhir hakiki dari Imperium Sasaniyah Persia; pintu Iran, Khurasan, dan Asia Tengah terbuka.',
  },
  {
    slug: 'fath-misr',
    nameAr: 'فتح مصر',
    nameId: 'Pembebasan Mesir',
    type: 'futuhat',
    eventDateAh: 20,
    eventDateCe: 640,
    eventDatePrecision: 'range',
    eventDateNotes: '18-21 H / 639-642 M',
    locationSlug: 'fustat',
    opponentForce: 'Romawi (Bizantium) di Mesir',
    muslimCount: 4000,
    outcome: 'victory',
    strategyId:
      '\'Amr bin al-\'Ash bergerak dari Palestina melalui al-\'Arisy, Farama, Bilbeis, lalu mengepung benteng Babilon (Babylon of Egypt) hingga jatuh; Iskandariyah menyusul.',
    narrativeId:
      'Pengepungan Babilon ~7 bulan; Muqauqis bernegosiasi dan menyerahkan Mesir. Iskandariyah jatuh setelah pengepungan panjang.',
    significanceId:
      'Mesir menjadi provinsi kunci Daulah Islam; \'Amr mendirikan kota Fusthath sebagai ibukota — cikal bakal Kairo.',
  },
]

export async function seed026Ghazwah(): Promise<void> {
  const db = getSeedDb()
  const locs = await db.select().from(locations)
  const locBySlug = new Map(locs.map((l) => [l.slug, l.id]))
  const figs = await db.select().from(figures)
  const figBySlug = new Map(figs.map((f) => [f.slug, f.id]))

  let total = 0
  for (const b of BATTLES) {
    const locationId = b.locationSlug ? locBySlug.get(b.locationSlug) : undefined
    const commanderId = b.commanderSlug ? figBySlug.get(b.commanderSlug) : undefined
    const result = await db
      .insert(battles)
      .values({
        slug: b.slug,
        nameAr: b.nameAr,
        nameId: b.nameId,
        type: b.type,
        eventDateAh: b.eventDateAh,
        eventDateCe: b.eventDateCe,
        eventDatePrecision: b.eventDatePrecision ?? 'year',
        eventDateNotes: b.eventDateNotes,
        locationId,
        commanderId,
        opponentForce: b.opponentForce,
        muslimCount: b.muslimCount,
        opponentCount: b.opponentCount,
        outcome: b.outcome,
        casualtiesMuslim: b.casualtiesMuslim,
        casualtiesOpponent: b.casualtiesOpponent,
        strategyId: b.strategyId,
        narrativeId: b.narrativeId,
        significanceId: b.significanceId,
        status: 'published',
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    if (result.length > 0) total++
  }
  logSeed('ghazwah', total)
}
