import { getSeedDb, logSeed } from './_helpers.js'
import { pdfTemplates } from '../schema/index.js'

const TEMPLATES = [
  {
    slug: 'classic',
    nameId: 'Klasik',
    nameAr: 'كلاسيكي',
    templatePath: 'templates/classic/index.html',
    supportsOrientation: ['portrait', 'landscape'],
    isActive: true,
  },
  {
    slug: 'modern',
    nameId: 'Modern',
    nameAr: 'حديث',
    templatePath: 'templates/modern/index.html',
    supportsOrientation: ['portrait', 'landscape'],
    isActive: true,
  },
  {
    slug: 'calligraphy',
    nameId: 'Kaligrafi',
    nameAr: 'خط',
    templatePath: 'templates/calligraphy/index.html',
    supportsOrientation: ['portrait'],
    isActive: true,
  },
  {
    slug: 'minimalist',
    nameId: 'Minimalis',
    nameAr: 'بسيط',
    templatePath: 'templates/minimalist/index.html',
    supportsOrientation: ['portrait', 'landscape'],
    isActive: true,
  },
]

export async function seed014PdfTemplates() {
  const db = getSeedDb()
  const result = await db
    .insert(pdfTemplates)
    .values(TEMPLATES)
    .onConflictDoNothing()
    .returning()
  logSeed('pdf_templates', result.length)
}
