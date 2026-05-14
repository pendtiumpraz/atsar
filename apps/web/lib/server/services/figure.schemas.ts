// Zod schemas for figure CRUD inputs.  Used by both route handlers and the
// service layer.  See docs/BACKEND.md §7 (Validation).

import { z } from 'zod'

// ── Enums (kept loose-coupled from the DB enum exports so the validators
// remain serializable + shareable with the client).
const genderValues = ['male', 'female'] as const
const contentStatusValues = [
  'draft',
  'under_review',
  'needs_edit',
  'approved',
  'published',
  'unpublished',
  'archived',
] as const
const socialCategoryValues = [
  'anshar',
  'muhajirin',
  'qurasy',
  'arab_non_qurasy',
  'mawla',
  'non_arab',
  'other',
] as const
const madhabValues = [
  'shafii',
  'maliki',
  'hanafi',
  'hanbali',
  'zhahiri',
  'no_madhab',
] as const
const rijalGradeValues = [
  'sahabi_udul',
  'thiqah_thiqah',
  'thiqah_hafidz',
  'thiqah',
  'saduq',
  'la_basa_bih',
  'shalih_al_hadith',
  'layyin',
  'daif',
  'matruk',
  'kadhdhab',
  'not_narrator',
  'unverified',
] as const
const datePrecisionValues = ['year', 'month', 'day', 'approximate', 'range'] as const
const deathCauseValues = ['natural', 'martyr', 'killed', 'unknown'] as const

// Loose `slug` shape: lowercase letters, digits and dashes only.
export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case')

// ── List query ────────────────────────────────────────────────────────
export const listFiguresQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(64).optional(), // category slug
  gender: z.enum(genderValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(250).default(20),
})
export type ListFiguresQuery = z.infer<typeof listFiguresQuerySchema>

// ── Trash list query ──────────────────────────────────────────────────
export const listTrashQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(250).default(20),
})
export type ListTrashQuery = z.infer<typeof listTrashQuerySchema>

// ── Create input ──────────────────────────────────────────────────────
export const createFigureSchema = z.object({
  slug: slugSchema,
  categoryId: z.string().uuid(),
  gender: z.enum(genderValues),

  nameFullAr: z.string().min(1).max(255),
  nameFullId: z.string().min(1).max(255),
  nameShortAr: z.string().max(255).optional().nullable(),
  nameShortId: z.string().max(255).optional().nullable(),
  kunyahAr: z.string().max(255).optional().nullable(),
  kunyahId: z.string().max(255).optional().nullable(),
  laqabAr: z.string().max(255).optional().nullable(),
  laqabId: z.string().max(255).optional().nullable(),

  birthDateAh: z.number().int().min(-200).max(1500).optional().nullable(),
  birthDateCe: z.number().int().min(-1000).max(2100).optional().nullable(),
  birthDatePrecision: z.enum(datePrecisionValues).optional().nullable(),
  birthDateNotes: z.string().max(2000).optional().nullable(),

  deathDateAh: z.number().int().min(-200).max(1500).optional().nullable(),
  deathDateCe: z.number().int().min(-1000).max(2100).optional().nullable(),
  deathDatePrecision: z.enum(datePrecisionValues).optional().nullable(),
  deathDateNotes: z.string().max(2000).optional().nullable(),
  deathCause: z.enum(deathCauseValues).optional().nullable(),

  socialCategory: z.array(z.enum(socialCategoryValues)).optional().nullable(),
  specialty: z.array(z.string().min(1).max(64)).optional().nullable(),
  madhab: z.enum(madhabValues).optional().nullable(),

  rijalGrade: z.enum(rijalGradeValues).optional(),
  rijalNotesAr: z.string().max(4000).optional().nullable(),
  rijalNotesId: z.string().max(4000).optional().nullable(),

  hadithCountMin: z.number().int().min(0).optional().nullable(),
  hadithCountMax: z.number().int().min(0).optional().nullable(),

  summaryAr: z.string().max(8000).optional().nullable(),
  summaryId: z.string().max(8000).optional().nullable(),
  biographyAr: z.string().optional().nullable(),
  biographyId: z.string().optional().nullable(),
  biographyPreWafatAr: z.string().optional().nullable(),
  biographyPreWafatId: z.string().optional().nullable(),
  biographyPostWafatAr: z.string().optional().nullable(),
  biographyPostWafatId: z.string().optional().nullable(),

  primaryLocationId: z.string().uuid().optional().nullable(),
  deathLocationId: z.string().uuid().optional().nullable(),
  burialLocationId: z.string().uuid().optional().nullable(),

  status: z.enum(contentStatusValues).optional(),
})
export type CreateFigureInput = z.infer<typeof createFigureSchema>

// ── Update input ──────────────────────────────────────────────────────
// All fields optional; slug change is allowed but must remain kebab-case.
export const updateFigureSchema = createFigureSchema.partial()
export type UpdateFigureInput = z.infer<typeof updateFigureSchema>

// ── UUID param helper (for trash routes) ──────────────────────────────
export const uuidParamSchema = z.object({ id: z.string().uuid() })
export const slugParamSchema = z.object({ slug: slugSchema })
