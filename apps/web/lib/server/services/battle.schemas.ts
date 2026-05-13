// Zod schemas for battle CRUD inputs. Used by both route handlers and the
// service layer. See docs/BACKEND.md §7 (Validation).

import { z } from 'zod'

// ── Enums (loose-coupled from the DB enum exports) ────────────────────
const battleTypeValues = ['ghazwah', 'sariyyah', 'futuhat'] as const
const battleOutcomeValues = ['victory', 'defeat', 'truce', 'partial'] as const
const battleParticipantRoleValues = [
  'commander',
  'sahabat',
  'fallen',
  'captured',
] as const
const contentStatusValues = [
  'draft',
  'under_review',
  'needs_edit',
  'approved',
  'published',
  'unpublished',
  'archived',
] as const
const datePrecisionValues = ['year', 'month', 'day', 'approximate', 'range'] as const

// Loose `slug` shape: lowercase letters, digits and dashes only.
export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case')

// ── List query ────────────────────────────────────────────────────────
export const listBattlesQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  type: z.enum(battleTypeValues).optional(),
  outcome: z.enum(battleOutcomeValues).optional(),
  fromAh: z.coerce.number().int().min(-200).max(1500).optional(),
  toAh: z.coerce.number().int().min(-200).max(1500).optional(),
  locationId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListBattlesQuery = z.infer<typeof listBattlesQuerySchema>

// ── Trash list query ──────────────────────────────────────────────────
export const listTrashQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type ListTrashQuery = z.infer<typeof listTrashQuerySchema>

// ── Create input ──────────────────────────────────────────────────────
export const createBattleSchema = z.object({
  slug: slugSchema,
  nameAr: z.string().min(1).max(255),
  nameId: z.string().min(1).max(255),
  type: z.enum(battleTypeValues),

  eventDateAh: z.number().int().min(-200).max(1500).optional().nullable(),
  eventDateCe: z.number().int().min(-1000).max(2100).optional().nullable(),
  eventDatePrecision: z.enum(datePrecisionValues).optional().nullable(),
  eventDateNotes: z.string().max(2000).optional().nullable(),

  locationId: z.string().uuid().optional().nullable(),
  commanderId: z.string().uuid().optional().nullable(),

  opponentForce: z.string().max(255).optional().nullable(),
  muslimCount: z.number().int().min(0).optional().nullable(),
  opponentCount: z.number().int().min(0).optional().nullable(),
  outcome: z.enum(battleOutcomeValues).optional().nullable(),
  casualtiesMuslim: z.number().int().min(0).optional().nullable(),
  casualtiesOpponent: z.number().int().min(0).optional().nullable(),

  strategyAr: z.string().max(8000).optional().nullable(),
  strategyId: z.string().max(8000).optional().nullable(),
  narrativeAr: z.string().optional().nullable(),
  narrativeId: z.string().optional().nullable(),
  significanceAr: z.string().max(8000).optional().nullable(),
  significanceId: z.string().max(8000).optional().nullable(),

  status: z.enum(contentStatusValues).optional(),
})
export type CreateBattleInput = z.infer<typeof createBattleSchema>

// ── Update input ──────────────────────────────────────────────────────
// All fields optional; slug change is allowed but must remain kebab-case.
export const updateBattleSchema = createBattleSchema.partial()
export type UpdateBattleInput = z.infer<typeof updateBattleSchema>

// ── Add participant input ─────────────────────────────────────────────
export const addParticipantSchema = z.object({
  figureId: z.string().uuid(),
  role: z.enum(battleParticipantRoleValues),
  notesAr: z.string().max(4000).optional().nullable(),
  notesId: z.string().max(4000).optional().nullable(),
})
export type AddParticipantInput = z.infer<typeof addParticipantSchema>

// ── UUID / slug param helpers ─────────────────────────────────────────
export const uuidParamSchema = z.object({ id: z.string().uuid() })
export const slugParamSchema = z.object({ slug: slugSchema })
