// GET  /api/v1/admin/users  — list users (paginated)
// POST /api/v1/admin/users  — invite a new user (sends magic link)
// Permissions: GET → `users.view`, POST → `users.invite`.

import { z } from 'zod'

import { created, paginatedOk, validateBody, validateQuery, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as userService from '@/lib/server/services/user.service'

const listQuerySchema = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['active', 'unverified', 'deleted']).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(200).default(20),
})

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  fullName: z.string().trim().min(1).max(120),
  roleSlug: z.string().trim().min(1).max(64),
})

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'users.view')
  const url = new URL(req.url)
  const q = validateQuery(url.searchParams, listQuerySchema)
  const { rows, total } = await userService.list(q)
  return paginatedOk(rows, { page: q.page ?? 1, perPage: q.perPage ?? 20, total })
})

export const POST = withErrorHandling(async (req) => {
  await requirePermission(req, 'users.invite')
  const input = await validateBody(req, inviteSchema)
  // TODO(actor): resolve actorId from session once auth middleware lands.
  const result = await userService.invite(input, null)
  return created(result)
})
