import { getSeedDb, logSeed } from './_helpers.js'
import { figureCategories } from '../schema/index.js'

const CATEGORIES = [
  {
    slug: 'nabi',
    nameId: 'Para Nabi & Rasul',
    nameAr: 'الأنبياء والرسل',
    description: '25 nabi wajib + lainnya yang shahih disebut.',
    sortOrder: 10,
  },
  {
    slug: 'shalih_pre_rasul',
    nameId: 'Shalih & Shalihah (Sebelum Rasul ﷺ)',
    nameAr: 'الصالحون قبل النبي ﷺ',
    description: 'Tokoh shalih sebelum kenabian Muhammad ﷺ — Maryam, Asiyah, Luqman, Ashabul Kahfi, dll.',
    sortOrder: 20,
  },
  {
    slug: 'sahabat',
    nameId: 'Sahabat & Shahabiyat',
    nameAr: 'الصحابة والصحابيات',
    description: 'Para sahabat Nabi Muhammad ﷺ.',
    sortOrder: 30,
  },
  {
    slug: 'tabiin',
    nameId: "Tabi'in & Tabi'iyyat",
    nameAr: 'التابعون والتابعيات',
    description: "Murid para sahabat.",
    sortOrder: 40,
  },
  {
    slug: 'tabiut_tabiin',
    nameId: "Tabi'ut Tabi'in & Tabi'at Tabi'iyyat",
    nameAr: 'تابعو التابعين وتابعات التابعيات',
    description: "Murid tabi'in.",
    sortOrder: 50,
  },
  {
    slug: 'shalih_pasca_rasul',
    nameId: 'Shalih & Shalihah (Pasca Rasul ﷺ → 2026)',
    nameAr: 'الصالحون بعد النبي ﷺ',
    description:
      'Ulama besar di luar generasi tabi\'ut tabi\'in — Imam Nawawi, Ibnu Taimiyyah, Bin Baz, Albani, Utsaimin, dll.',
    sortOrder: 60,
  },
]

export async function seed007FigureCategories() {
  const db = getSeedDb()
  const result = await db
    .insert(figureCategories)
    .values(CATEGORIES)
    .onConflictDoNothing()
    .returning()
  logSeed('figure_categories', result.length)
}
