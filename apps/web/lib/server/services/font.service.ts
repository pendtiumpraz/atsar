// Font service — admin-configurable typography (IDEAS.md §3b).
//
// Concepts:
//   - `fonts`               — catalogue of installable fonts (soft-deletable).
//   - `font_assignments`    — exactly 0 or 1 row per role slot; the currently
//                             active font for that slot.
//   - `font_assignment_history` — append-only audit trail of every swap.
//
// All mutations write `audit_log` (see BACKEND.md §11).  Activation runs in a
// single `db.batch([...])` so the slot is never observed in a half-applied
// state.

import { and, asc, eq, inArray, isNull, ne, sql } from 'drizzle-orm'

import { db } from '@athar/db'
import { fontAssignmentHistory, fontAssignments, fonts } from '@athar/db/schema'

import { ApiError } from '@/lib/server/api'
import { auditLog } from './audit.service.js'

// ── Enum mirrors (kept loosely coupled from the DB enum exports) ─────
export const FONT_SCRIPTS = ['latin', 'arabic', 'mono', 'both'] as const
export type FontScript = (typeof FONT_SCRIPTS)[number]

export const FONT_SOURCES = ['google_fonts', 'custom_url', 'uploaded'] as const
export type FontSource = (typeof FONT_SOURCES)[number]

export const FONT_ROLES = [
  'display_latin',
  'body_latin',
  'display_arab',
  'section_arab',
  'body_arab',
  'quran_arab',
  'mono',
] as const
export type FontRole = (typeof FONT_ROLES)[number]

// ── Row types ────────────────────────────────────────────────────────
export type FontRow = typeof fonts.$inferSelect
export type FontInsert = typeof fonts.$inferInsert
export type FontAssignmentRow = typeof fontAssignments.$inferSelect

export interface ListFontsInput {
  script?: FontScript
  isActive?: boolean
  page?: number
  perPage?: number
}

export interface ListFontsResult {
  rows: FontRow[]
  total: number
  page: number
  perPage: number
}

export interface CreateFontInput {
  name: string
  family: string
  script: FontScript
  source: FontSource
  googleFamilyName?: string | null
  customUrl?: string | null
  filePaths?: Record<string, string> | null
  weights?: number[] | null
  styles?: string[] | null
  unicodeRange?: string | null
  previewTextAr?: string | null
  previewTextId?: string | null
  license?: string | null
  isActive?: boolean
}

export type UpdateFontInput = Partial<CreateFontInput>

export interface ActivateInput {
  role: FontRole
  fontId: string
  activatedBy: string | null
}

/**
 * One slot in the public theme manifest.  `googleFamilyName` is populated when
 * the source is Google Fonts so the browser can load it from the CDN.
 */
export interface ActiveAssignmentEntry {
  fontId: string
  family: string
  source: FontSource
  googleFamilyName: string | null
  customUrl: string | null
  weights: number[] | null
  styles: string[] | null
}

export type ActiveAssignmentsMap = Record<FontRole, ActiveAssignmentEntry | null>

/**
 * Public-theme payload shape consumed by the SSR layout to inject CSS vars
 * and prefetch font files.
 */
export interface PublicThemeFonts extends Record<FontRole, string | null> {
  googleFonts: Array<{
    family: string
    weights: number[]
    styles: string[]
  }>
}

// ── Internal helpers ─────────────────────────────────────────────────
function isValidScriptForRole(script: FontScript, role: FontRole): boolean {
  // Cross-script assignment is rejected — Latin font into Arab slot, etc.
  // `both` and matching scripts are allowed; `mono` only for `mono`.
  if (role === 'mono') return script === 'mono' || script === 'both'
  const arabRoles: FontRole[] = ['display_arab', 'section_arab', 'body_arab', 'quran_arab']
  if (arabRoles.includes(role)) return script === 'arabic' || script === 'both'
  const latinRoles: FontRole[] = ['display_latin', 'body_latin']
  if (latinRoles.includes(role)) return script === 'latin' || script === 'both'
  return false
}

async function findById(id: string): Promise<FontRow | undefined> {
  return db.query.fonts.findFirst({
    where: and(eq(fonts.id, id), isNull(fonts.deletedAt)),
  })
}

// ── List ─────────────────────────────────────────────────────────────
export async function list(input: ListFontsInput = {}): Promise<ListFontsResult> {
  const page = input.page ?? 1
  const perPage = input.perPage ?? 50
  const offset = (page - 1) * perPage

  const where = [isNull(fonts.deletedAt)]
  if (input.script) where.push(eq(fonts.script, input.script))
  if (input.isActive !== undefined) where.push(eq(fonts.isActive, input.isActive))

  const whereExpr = and(...where)

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(fonts)
      .where(whereExpr)
      .orderBy(asc(fonts.family))
      .limit(perPage)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(fonts).where(whereExpr),
  ])

  return {
    rows,
    total: totalRow[0]?.count ?? 0,
    page,
    perPage,
  }
}

// ── Get by id ────────────────────────────────────────────────────────
export async function getById(id: string): Promise<FontRow> {
  const row = await findById(id)
  if (!row) throw new ApiError('NOT_FOUND', `Font tidak ditemukan: ${id}`)
  return row
}

// ── Create ───────────────────────────────────────────────────────────
export async function create(
  input: CreateFontInput,
  actorId: string | null,
): Promise<FontRow> {
  // family must be unique among active rows.
  const clash = await db.query.fonts.findFirst({
    where: and(eq(fonts.family, input.family), isNull(fonts.deletedAt)),
  })
  if (clash) {
    throw new ApiError('CONFLICT', `Font family sudah terdaftar: ${input.family}`, {
      fieldErrors: { family: 'Family sudah dipakai' },
    })
  }

  // Source-specific sanity: google_fonts → require googleFamilyName,
  // custom_url → require customUrl, uploaded → require filePaths.
  if (input.source === 'google_fonts' && !input.googleFamilyName) {
    throw new ApiError('VALIDATION_ERROR', 'googleFamilyName wajib untuk source=google_fonts', {
      fieldErrors: { googleFamilyName: 'Wajib diisi' },
    })
  }
  if (input.source === 'custom_url' && !input.customUrl) {
    throw new ApiError('VALIDATION_ERROR', 'customUrl wajib untuk source=custom_url', {
      fieldErrors: { customUrl: 'Wajib diisi' },
    })
  }
  if (input.source === 'uploaded' && (!input.filePaths || Object.keys(input.filePaths).length === 0)) {
    throw new ApiError('VALIDATION_ERROR', 'filePaths wajib untuk source=uploaded', {
      fieldErrors: { filePaths: 'Wajib diisi' },
    })
  }

  const values: FontInsert = {
    name: input.name,
    family: input.family,
    script: input.script,
    source: input.source,
    googleFamilyName: input.googleFamilyName ?? null,
    customUrl: input.customUrl ?? null,
    filePaths: input.filePaths ?? null,
    weights: input.weights ?? null,
    styles: input.styles ?? null,
    unicodeRange: input.unicodeRange ?? null,
    previewTextAr: input.previewTextAr ?? null,
    previewTextId: input.previewTextId ?? null,
    license: input.license ?? null,
    isActive: input.isActive ?? false,
    createdBy: actorId ?? null,
    updatedBy: actorId ?? null,
  }

  const [row] = await db.insert(fonts).values(values).returning()
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Gagal membuat font')

  await auditLog.write({
    actorId,
    action: 'create',
    resourceType: 'font',
    resourceId: row.id,
    diff: { after: row },
  })

  return row
}

// ── Update ───────────────────────────────────────────────────────────
export async function update(
  id: string,
  input: UpdateFontInput,
  actorId: string | null,
): Promise<FontRow> {
  const before = await getById(id)

  // If family changes, ensure no collision with another active row.
  if (input.family !== undefined && input.family !== before.family) {
    const clash = await db.query.fonts.findFirst({
      where: and(
        eq(fonts.family, input.family),
        isNull(fonts.deletedAt),
        ne(fonts.id, id),
      ),
    })
    if (clash) {
      throw new ApiError('CONFLICT', `Font family sudah terdaftar: ${input.family}`, {
        fieldErrors: { family: 'Family sudah dipakai' },
      })
    }
  }

  const patch: Partial<FontInsert> = {
    updatedAt: new Date(),
    updatedBy: actorId ?? null,
  }
  if (input.name !== undefined) patch.name = input.name
  if (input.family !== undefined) patch.family = input.family
  if (input.script !== undefined) patch.script = input.script
  if (input.source !== undefined) patch.source = input.source
  if (input.googleFamilyName !== undefined) patch.googleFamilyName = input.googleFamilyName
  if (input.customUrl !== undefined) patch.customUrl = input.customUrl
  if (input.filePaths !== undefined) patch.filePaths = input.filePaths
  if (input.weights !== undefined) patch.weights = input.weights
  if (input.styles !== undefined) patch.styles = input.styles
  if (input.unicodeRange !== undefined) patch.unicodeRange = input.unicodeRange
  if (input.previewTextAr !== undefined) patch.previewTextAr = input.previewTextAr
  if (input.previewTextId !== undefined) patch.previewTextId = input.previewTextId
  if (input.license !== undefined) patch.license = input.license
  if (input.isActive !== undefined) patch.isActive = input.isActive

  const [row] = await db.update(fonts).set(patch).where(eq(fonts.id, id)).returning()
  if (!row) throw new ApiError('INTERNAL_ERROR', 'Gagal update font')

  await auditLog.write({
    actorId,
    action: 'update',
    resourceType: 'font',
    resourceId: id,
    diff: { before, after: row },
  })

  return row
}

// ── Soft delete ──────────────────────────────────────────────────────
export async function softDelete(id: string, actorId: string | null): Promise<void> {
  const row = await getById(id)

  // Refuse if the font is currently assigned to any role slot — admin must
  // swap to another font first.
  const assigned = await db
    .select({ role: fontAssignments.role })
    .from(fontAssignments)
    .where(and(eq(fontAssignments.fontId, id), isNull(fontAssignments.deletedAt)))
  if (assigned.length > 0) {
    const roles = assigned.map((r) => r.role).join(', ')
    throw new ApiError(
      'CONFLICT',
      `Font sedang aktif di slot: ${roles}. Aktifkan font lain dulu sebelum menghapus.`,
    )
  }

  const now = new Date()
  await db
    .update(fonts)
    .set({ deletedAt: now, deletedBy: actorId ?? null, updatedBy: actorId ?? null })
    .where(eq(fonts.id, id))

  await auditLog.write({
    actorId,
    action: 'soft_delete',
    resourceType: 'font',
    resourceId: id,
    diff: { family: row.family },
  })
}

// ── Activate (atomic slot swap) ──────────────────────────────────────
export async function activate(input: ActivateInput): Promise<FontAssignmentRow> {
  const { role, fontId, activatedBy } = input

  const font = await getById(fontId)
  if (!isValidScriptForRole(font.script, role)) {
    throw new ApiError(
      'VALIDATION_ERROR',
      `Font script "${font.script}" tidak cocok untuk slot "${role}"`,
      { fieldErrors: { fontId: 'Script tidak cocok dengan slot' } },
    )
  }

  // Capture existing assignment (if any) for the history row.
  const existing = await db.query.fontAssignments.findFirst({
    where: and(eq(fontAssignments.role, role), isNull(fontAssignments.deletedAt)),
  })
  const oldFontId = existing?.fontId ?? null

  // Short-circuit if the font is already assigned to this slot — still write
  // history + audit so the operation is observable.
  if (existing && existing.fontId === fontId) {
    await auditLog.write({
      actorId: activatedBy,
      action: 'config_change',
      resourceType: 'font_assignment',
      resourceId: existing.id,
      diff: { role, fontId: [fontId, fontId], note: 'no-op activate' },
    })
    return existing
  }

  // Hard-delete the previous assignment row + insert the new one + append
  // history in a single batch.  Neon-http does not expose `db.transaction` —
  // `db.batch([...])` gives single-round-trip atomicity.  The `(role)` unique
  // index on `font_assignments` ensures no race can produce two active rows.
  const insertNew = db
    .insert(fontAssignments)
    .values({
      role,
      fontId,
      activatedBy: activatedBy ?? null,
      createdBy: activatedBy ?? null,
      updatedBy: activatedBy ?? null,
    })
    .returning()

  const insertHistory = db.insert(fontAssignmentHistory).values({
    role,
    oldFontId,
    newFontId: fontId,
    changedBy: activatedBy ?? null,
  })

  let inserted: FontAssignmentRow | undefined
  if (existing) {
    const results = await db.batch([
      db.delete(fontAssignments).where(eq(fontAssignments.id, existing.id)),
      insertNew,
      insertHistory,
    ])
    inserted = results[1][0]
  } else {
    const results = await db.batch([insertNew, insertHistory])
    inserted = results[0][0]
  }
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Gagal mengaktifkan font')

  await auditLog.write({
    actorId: activatedBy,
    action: 'config_change',
    resourceType: 'font_assignment',
    resourceId: inserted.id,
    diff: { role, fontId: [oldFontId, fontId] },
  })

  return inserted
}

// ── Active assignments (admin view) ──────────────────────────────────
export async function getActiveAssignments(): Promise<ActiveAssignmentsMap> {
  const rows = await db
    .select({
      role: fontAssignments.role,
      fontId: fonts.id,
      family: fonts.family,
      source: fonts.source,
      googleFamilyName: fonts.googleFamilyName,
      customUrl: fonts.customUrl,
      weights: fonts.weights,
      styles: fonts.styles,
    })
    .from(fontAssignments)
    .innerJoin(fonts, and(eq(fonts.id, fontAssignments.fontId), isNull(fonts.deletedAt)))
    .where(isNull(fontAssignments.deletedAt))

  // Pre-fill every role with `null` so consumers always get the full slot map.
  const out = FONT_ROLES.reduce<ActiveAssignmentsMap>((acc, r) => {
    acc[r] = null
    return acc
  }, {} as ActiveAssignmentsMap)

  for (const r of rows) {
    out[r.role as FontRole] = {
      fontId: r.fontId,
      family: r.family,
      source: r.source as FontSource,
      googleFamilyName: r.googleFamilyName,
      customUrl: r.customUrl,
      weights: r.weights,
      styles: r.styles,
    }
  }

  return out
}

// ── Public theme payload (SSR layout) ────────────────────────────────
export async function getPublicTheme(): Promise<PublicThemeFonts> {
  const assignments = await getActiveAssignments()

  // CSS-var map: role → family name (or null when slot is empty).
  const out: PublicThemeFonts = FONT_ROLES.reduce<PublicThemeFonts>((acc, r) => {
    ;(acc as unknown as Record<string, unknown>)[r] = assignments[r]?.family ?? null
    return acc
  }, { googleFonts: [] } as unknown as PublicThemeFonts)

  // De-dupe google-fonts list so we only emit one <link> per family.
  const seen = new Set<string>()
  for (const role of FONT_ROLES) {
    const a = assignments[role]
    if (!a) continue
    if (a.source !== 'google_fonts') continue
    const family = a.googleFamilyName ?? a.family
    if (seen.has(family)) continue
    seen.add(family)
    out.googleFonts.push({
      family,
      weights: a.weights ?? [400],
      styles: a.styles ?? ['normal'],
    })
  }

  return out
}

// ── Resolve a set of fonts by ids (used by activate UI dropdown) ─────
export async function getByIds(ids: string[]): Promise<FontRow[]> {
  if (ids.length === 0) return []
  return db
    .select()
    .from(fonts)
    .where(and(inArray(fonts.id, ids), isNull(fonts.deletedAt)))
}

// ── Namespaced export ────────────────────────────────────────────────
export const fontService = {
  list,
  getById,
  getByIds,
  create,
  update,
  softDelete,
  activate,
  getActiveAssignments,
  getPublicTheme,
}
