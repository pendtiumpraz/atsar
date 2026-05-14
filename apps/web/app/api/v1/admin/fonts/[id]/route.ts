// GET    /api/v1/admin/fonts/[id]
// PATCH  /api/v1/admin/fonts/[id]   (partial)
// PUT    /api/v1/admin/fonts/[id]   (alias for PATCH; legacy callers like fonts-table)
// DELETE /api/v1/admin/fonts/[id]   (soft-delete; refuses if assigned)
// Permissions: GET → `fonts.view`, PATCH/PUT/DELETE → `fonts.manage`.

import { z } from 'zod'

import {
  noContent,
  ok,
  validateBody,
  validateParams,
  withErrorHandling,
} from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as fontService from '@/lib/server/services/font.service'
import { FONT_SCRIPTS, FONT_SOURCES } from '@/lib/server/services/font.service'

const paramsSchema = z.object({ id: z.string().uuid() })

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  family: z.string().trim().min(1).max(120).optional(),
  script: z.enum(FONT_SCRIPTS).optional(),
  source: z.enum(FONT_SOURCES).optional(),
  googleFamilyName: z.string().trim().min(1).max(120).nullable().optional(),
  customUrl: z.string().trim().url().max(500).nullable().optional(),
  filePaths: z.record(z.string().min(1)).nullable().optional(),
  weights: z.array(z.number().int().min(100).max(900)).max(20).nullable().optional(),
  styles: z.array(z.string().trim().min(1).max(32)).max(20).nullable().optional(),
  unicodeRange: z.string().trim().max(2000).nullable().optional(),
  previewTextAr: z.string().trim().max(500).nullable().optional(),
  previewTextId: z.string().trim().max(500).nullable().optional(),
  license: z.string().trim().max(120).nullable().optional(),
  isActive: z.boolean().optional(),
})

type RouteCtx = { params: Promise<{ id: string }> | { id: string } }

export const GET = withErrorHandling<RouteCtx>(async (req, ctx) => {
  await requirePermission(req, 'fonts.view')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const row = await fontService.getById(id)
  return ok(row)
})

export const PATCH = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'fonts.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  const input = await validateBody(req, updateSchema)
  const row = await fontService.update(id, input, userId)
  return ok(row)
})

// Legacy PUT alias — fonts-table.tsx still sends PUT for the activate toggle.
export const PUT = PATCH

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'fonts.manage')
  const { id } = validateParams(await ctx.params, paramsSchema)
  await fontService.softDelete(id, userId)
  return noContent()
})
