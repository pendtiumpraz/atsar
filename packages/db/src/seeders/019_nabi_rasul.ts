// Seeds the 24 Nabi & Rasul wajib (excluding Muhammad ﷺ — already seeded by 017).
// Source: Quran + Hadits + Qashash al-Anbiya. Dates are approximate where applicable;
// for figures with no reliable date, AH/CE are left null with `birthDatePrecision: 'approximate'`.

import { getSeedDb, logSeed } from './_helpers.js'
import { figures, figureCategories } from '../schema/index.js'

type DatePrecision = 'year' | 'month' | 'day' | 'approximate' | 'range'

type NabiSeed = {
  slug: string
  nameFullAr: string
  nameFullId: string
  laqabId?: string
  birthAh?: number | null
  birthCe?: number | null
  birthDatePrecision?: DatePrecision
  birthDateNotes?: string
  deathAh?: number | null
  deathCe?: number | null
  deathDatePrecision?: DatePrecision
  deathDateNotes?: string
  summaryId: string
  summaryAr: string
}

// Note on dates: years given as approximate centuries based on widely-cited Islamic
// chronology (Qashash al-Anbiya, Tarikh ath-Thabari). Negative AH = pre-Hijra (1H = 622 CE),
// so SH (Sebelum Hijriah) ≈ Hijri year * -1. Many ancient nabi have no firm dates; in those
// cases AH/CE are null with `birthDatePrecision: 'approximate'` and an explanatory note.
const NABI: NabiSeed[] = [
  {
    slug: 'nabi-adam',
    nameFullAr: 'آدم عليه السلام',
    nameFullId: 'Adam AS',
    laqabId: 'Abul Basyar (Bapak Manusia)',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Tanggal tidak diketahui secara pasti.',
    deathDatePrecision: 'approximate',
    deathDateNotes: 'Tanggal tidak diketahui secara pasti.',
    summaryId: 'Manusia pertama dan nabi pertama, bapak seluruh umat manusia.',
    summaryAr: 'أول البشر وأول الأنبياء، أبو البشرية جمعاء.',
  },
  {
    slug: 'nabi-idris',
    nameFullAr: 'إدريس عليه السلام',
    nameFullId: 'Idris AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar 3000 SM, sebelum masa Nabi Nuh.',
    deathDatePrecision: 'approximate',
    summaryId: 'Nabi yang pertama menulis dengan pena dan diangkat ke tempat yang tinggi.',
    summaryAr: 'أول من خط بالقلم، رفعه الله مكانًا عليًّا.',
  },
  {
    slug: 'nabi-nuh',
    nameFullAr: 'نوح عليه السلام',
    nameFullId: 'Nuh AS',
    laqabId: 'Abul Anbiya ats-Tsani (Bapak Para Nabi Kedua)',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar 3000-2500 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Rasul Ulul Azmi yang berdakwah 950 tahun dan diselamatkan dari banjir besar dengan bahteranya.',
    summaryAr: 'من أولي العزم، دعا قومه ألف سنة إلا خمسين عامًا، ونجاه الله ومن آمن معه في السفينة.',
  },
  {
    slug: 'nabi-hud',
    nameFullAr: 'هود عليه السلام',
    nameFullId: 'Hud AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar 2500 SM, diutus kepada kaum ‘Ad.',
    deathDatePrecision: 'approximate',
    summaryId: 'Diutus kepada kaum ‘Ad di Al-Ahqaf untuk meninggalkan kesyirikan; kaumnya dibinasakan oleh angin.',
    summaryAr: 'أُرسل إلى قوم عاد في الأحقاف، فكذبوه فأهلكهم الله بريح صرصر عاتية.',
  },
  {
    slug: 'nabi-shalih',
    nameFullAr: 'صالح عليه السلام',
    nameFullId: 'Shalih AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar 2500 SM, diutus kepada kaum Tsamud.',
    deathDatePrecision: 'approximate',
    summaryId: 'Diutus kepada kaum Tsamud dengan mukjizat unta betina; kaumnya dibinasakan dengan suara yang mengguntur.',
    summaryAr: 'أُرسل إلى قوم ثمود وآيته الناقة، فعقروها فأخذتهم الصيحة.',
  },
  {
    slug: 'nabi-ibrahim',
    nameFullAr: 'إبراهيم عليه السلام',
    nameFullId: 'Ibrahim AS',
    laqabId: 'Khalilullah (Kekasih Allah), Abul Anbiya',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar 2000-1900 SM, lahir di wilayah Babilonia/Ur.',
    deathDatePrecision: 'approximate',
    summaryId: 'Rasul Ulul Azmi, Khalilullah, bapak para nabi; membangun Ka’bah bersama putranya Ismail.',
    summaryAr: 'من أولي العزم، خليل الرحمن، أبو الأنبياء، بنى الكعبة مع ابنه إسماعيل.',
  },
  {
    slug: 'nabi-luth',
    nameFullAr: 'لوط عليه السلام',
    nameFullId: 'Luth AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Semasa dengan Nabi Ibrahim AS, sekitar 2000-1900 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Keponakan Nabi Ibrahim AS; diutus kepada penduduk Sodom yang dibinasakan karena kekejian liwath.',
    summaryAr: 'ابن أخي إبراهيم، أُرسل إلى قوم سدوم فأهلكهم الله بفاحشتهم.',
  },
  {
    slug: 'nabi-ismail',
    nameFullAr: 'إسماعيل عليه السلام',
    nameFullId: 'Ismail AS',
    laqabId: 'Adz-Dzabih (Yang Disembelih)',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Putra sulung Nabi Ibrahim AS, sekitar abad ke-19 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Putra sulung Nabi Ibrahim AS, leluhur bangsa Arab; bersama ayahnya membangun Ka’bah.',
    summaryAr: 'البكر من أبناء إبراهيم، جد العرب المستعربة، بنى مع أبيه الكعبة.',
  },
  {
    slug: 'nabi-ishaq',
    nameFullAr: 'إسحاق عليه السلام',
    nameFullId: 'Ishaq AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Putra Nabi Ibrahim AS dari Sarah, sekitar abad ke-19 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Putra Nabi Ibrahim AS dari Sarah, ayah Nabi Yaqub AS.',
    summaryAr: 'ابن إبراهيم من سارة، وأبو يعقوب عليه السلام.',
  },
  {
    slug: 'nabi-yaqub',
    nameFullAr: 'يعقوب عليه السلام',
    nameFullId: 'Yaqub AS',
    laqabId: 'Israil',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Putra Nabi Ishaq AS, sekitar abad ke-18 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Putra Nabi Ishaq AS, dijuluki Israil; ayah dari dua belas asbath dan Nabi Yusuf AS.',
    summaryAr: 'ابن إسحاق، الملقب بإسرائيل، وأبو الأسباط الاثني عشر ومنهم يوسف عليه السلام.',
  },
  {
    slug: 'nabi-yusuf',
    nameFullAr: 'يوسف عليه السلام',
    nameFullId: 'Yusuf AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Putra Nabi Yaqub AS, sekitar abad ke-17 SM, di tanah Kan’an dan Mesir.',
    deathDatePrecision: 'approximate',
    summaryId: 'Putra Nabi Yaqub AS yang kisahnya disebut sebagai ahsanul qashash; menjadi bendahara Mesir.',
    summaryAr: 'ابن يعقوب الذي وصف الله قصته بأحسن القصص، وكان عزيز مصر.',
  },
  {
    slug: 'nabi-ayyub',
    nameFullAr: 'أيوب عليه السلام',
    nameFullId: 'Ayyub AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Keturunan Nabi Ishaq AS, sekitar abad ke-15 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Nabi yang menjadi teladan kesabaran atas ujian harta, keluarga, dan penyakit yang panjang.',
    summaryAr: 'مَثَل الصبر على البلاء في المال والأهل والجسد.',
  },
  {
    slug: 'nabi-syuaib',
    nameFullAr: 'شعيب عليه السلام',
    nameFullId: "Syu'aib AS",
    laqabId: 'Khathibul Anbiya (Orator Para Nabi)',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Diutus kepada penduduk Madyan, sebelum masa Nabi Musa AS.',
    deathDatePrecision: 'approximate',
    summaryId: 'Diutus kepada penduduk Madyan dan Aikah; menyeru kepada tauhid dan kejujuran dalam timbangan.',
    summaryAr: 'أُرسل إلى أهل مدين وأصحاب الأيكة، دعاهم إلى التوحيد وإيفاء الكيل والميزان.',
  },
  {
    slug: 'nabi-musa',
    nameFullAr: 'موسى عليه السلام',
    nameFullId: 'Musa AS',
    laqabId: 'Kalimullah (Yang Berbicara dengan Allah)',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar abad ke-14-13 SM, lahir di Mesir pada masa Fir’aun.',
    deathDatePrecision: 'approximate',
    summaryId: 'Rasul Ulul Azmi, Kalimullah; membawa Bani Israil keluar dari penindasan Fir’aun dan menerima Taurat.',
    summaryAr: 'من أولي العزم، كليم الرحمن، أخرج بني إسرائيل من ظلم فرعون وأُنزلت عليه التوراة.',
  },
  {
    slug: 'nabi-harun',
    nameFullAr: 'هارون عليه السلام',
    nameFullId: 'Harun AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Saudara kandung Nabi Musa AS, sekitar abad ke-14-13 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Saudara dan wazir Nabi Musa AS, fasih dalam menyampaikan dakwah kepada Bani Israil.',
    summaryAr: 'أخو موسى ووزيره، أفصح منه لسانًا، أعانه في تبليغ الرسالة إلى بني إسرائيل.',
  },
  {
    slug: 'nabi-dzulkifli',
    nameFullAr: 'ذو الكفل عليه السلام',
    nameFullId: 'Dzulkifli AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Diperkirakan setelah masa Nabi Ayyub AS.',
    deathDatePrecision: 'approximate',
    summaryId: 'Nabi yang disebut dalam Al-Quran sebagai termasuk orang-orang yang sabar dan baik.',
    summaryAr: 'من الأنبياء الذين ذكرهم الله بالصبر وأنه من الأخيار.',
  },
  {
    slug: 'nabi-daud',
    nameFullAr: 'داود عليه السلام',
    nameFullId: 'Daud AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar abad ke-10 SM (≈ 1000 SM), raja Bani Israil.',
    deathDatePrecision: 'approximate',
    summaryId: 'Nabi dan raja Bani Israil; diberi kitab Zabur dan kemampuan melunakkan besi.',
    summaryAr: 'نبي وملك بني إسرائيل، أُنزل عليه الزبور وأُلين له الحديد.',
  },
  {
    slug: 'nabi-sulaiman',
    nameFullAr: 'سليمان عليه السلام',
    nameFullId: 'Sulaiman AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Putra Nabi Daud AS, sekitar abad ke-10 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Putra Nabi Daud AS, raja yang diberi kerajaan yang tidak diberikan kepada siapa pun setelahnya, menundukkan jin dan angin.',
    summaryAr: 'ابن داود، أُوتي مُلكًا لا ينبغي لأحد من بعده، سُخّرت له الجن والريح.',
  },
  {
    slug: 'nabi-ilyas',
    nameFullAr: 'إلياس عليه السلام',
    nameFullId: 'Ilyas AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Sekitar abad ke-9 SM, diutus kepada Bani Israil.',
    deathDatePrecision: 'approximate',
    summaryId: 'Diutus kepada penduduk Ba’labakka untuk menyeru kembali dari penyembahan berhala Ba’l kepada tauhid.',
    summaryAr: 'أُرسل إلى أهل بعلبك يدعوهم إلى ترك عبادة الصنم بعل والرجوع إلى التوحيد.',
  },
  {
    slug: 'nabi-ilyasa',
    nameFullAr: 'اليسع عليه السلام',
    nameFullId: 'Ilyasa AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Penerus Nabi Ilyas AS, sekitar abad ke-9 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Nabi penerus Nabi Ilyas AS, melanjutkan dakwah kepada Bani Israil.',
    summaryAr: 'خلف إلياس في النبوة وواصل الدعوة في بني إسرائيل.',
  },
  {
    slug: 'nabi-yunus',
    nameFullAr: 'يونس عليه السلام',
    nameFullId: 'Yunus AS',
    laqabId: 'Dzun-Nun (Yang Punya Ikan)',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Diutus kepada penduduk Ninawa, sekitar abad ke-8 SM.',
    deathDatePrecision: 'approximate',
    summaryId: 'Diutus kepada penduduk Ninawa; ditelan ikan paus lalu bertaubat dan dikembalikan kepada kaumnya yang akhirnya beriman.',
    summaryAr: 'أُرسل إلى أهل نينوى، التقمه الحوت ثم نجاه الله بتسبيحه، فآمن قومه أجمعون.',
  },
  {
    slug: 'nabi-zakariya',
    nameFullAr: 'زكريا عليه السلام',
    nameFullId: 'Zakariya AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Hidup sezaman dengan Maryam binti Imran, sekitar 1 SM-1 M.',
    deathDatePrecision: 'approximate',
    summaryId: 'Penjaga Maryam binti Imran; berdoa di usia tua dan dikaruniai putra, yaitu Nabi Yahya AS.',
    summaryAr: 'كفل مريم بنت عمران، دعا ربه في الكبر فرزقه يحيى عليه السلام.',
  },
  {
    slug: 'nabi-yahya',
    nameFullAr: 'يحيى عليه السلام',
    nameFullId: 'Yahya AS',
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Putra Nabi Zakariya AS, sezaman dengan Nabi Isa AS.',
    deathDatePrecision: 'approximate',
    summaryId: 'Putra Nabi Zakariya AS, lahir atas mukjizat di usia tua orang tuanya; pembenar risalah Nabi Isa AS.',
    summaryAr: 'ابن زكريا، وُلد بآية في كبر أبويه، وصدّق بكلمة من الله — وهو عيسى عليه السلام.',
  },
  {
    slug: 'nabi-isa',
    nameFullAr: 'عيسى عليه السلام',
    nameFullId: 'Isa AS',
    laqabId: 'Al-Masih, Ibnu Maryam',
    birthAh: -628,
    birthCe: -6,
    birthDatePrecision: 'approximate',
    birthDateNotes: 'Lahir sekitar 6-4 SM (≈ -628 H) di Baitul Maqdis dari Maryam binti Imran tanpa ayah.',
    deathDatePrecision: 'approximate',
    deathDateNotes: 'Tidak wafat, melainkan diangkat oleh Allah ke langit; akan turun kembali di akhir zaman.',
    summaryId: 'Rasul Ulul Azmi, Al-Masih putra Maryam; diberi kitab Injil dan diangkat ke langit, akan turun di akhir zaman.',
    summaryAr: 'من أولي العزم، المسيح ابن مريم، أُنزل عليه الإنجيل ورفعه الله إليه، ينزل في آخر الزمان.',
  },
]

export async function seed019NabiRasul(): Promise<void> {
  const db = getSeedDb()
  const cats = await db.select().from(figureCategories)
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]))
  const categoryId = catBySlug.get('nabi')
  if (!categoryId) {
    console.warn('  ⚠ category nabi not found — run 007_figure_categories first')
    return
  }

  let total = 0
  for (const n of NABI) {
    const result = await db
      .insert(figures)
      .values({
        slug: n.slug,
        categoryId,
        gender: 'male',
        nameFullAr: n.nameFullAr,
        nameFullId: n.nameFullId,
        laqabId: n.laqabId,
        birthDateAh: n.birthAh ?? null,
        birthDateCe: n.birthCe ?? null,
        birthDatePrecision: n.birthDatePrecision,
        birthDateNotes: n.birthDateNotes,
        deathDateAh: n.deathAh ?? null,
        deathDateCe: n.deathCe ?? null,
        deathDatePrecision: n.deathDatePrecision,
        deathDateNotes: n.deathDateNotes,
        rijalGrade: 'not_narrator',
        summaryId: n.summaryId,
        summaryAr: n.summaryAr,
        status: 'published',
        publishedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning()
    if (result.length > 0) total++
  }
  logSeed('nabi_rasul', total)
}
