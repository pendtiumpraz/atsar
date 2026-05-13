// GET  /api/v1/admin/roles    — list roles
// POST /api/v1/admin/roles    — create a custom role (isSystem=false)
// Permission: `roles.manage`. See docs/BACKEND.md §5.

import { z } from 'zod'

import { created, ok, validateBody, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as roleService from '@/lib/server/services/role.service'

const createSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/, 'slug harus lowercase, snake_case'),
  nameId: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'roles.manage')
  const rows = await roleService.list()
  return ok(rows)
})

export const POST = withErrorHandling(async (req) => {
  await requirePermission(req, 'roles.manage')
  const input = await validateBody(req, createSchema)
  // TODO(actor): resolve actorId from session cookie once auth middleware lands.
  const row = await roleService.create(input, null)
  return created(row)
})
