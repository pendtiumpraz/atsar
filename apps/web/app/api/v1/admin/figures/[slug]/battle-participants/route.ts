// POST /api/v1/admin/figures/[slug]/battle-participants
//   → Attach this figure to a battle with a role.
//
// `battle_participants` is a composite-PK join table (battleId, figureId).
// Schema: see packages/db/src/schema/battles.ts.

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { battleParticipants, battles, figures } from '@athar/db/schema'

import { ApiError, created, validateBody, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { slugSchema } from '@/lib/server/services/figure.schemas'

const paramsSchema = z.object({ slug: slugSchema })

const roleValues = [
  'commander',
  'sub_commander',
  'sahabat',
  'fallen',
  'wounded',
  'captured',
  'witness',
  'flag_bearer',
  'envoy',
] as const

const createSchema = z.object({
  battleId: z.string().uuid(),
  role: z.enum(roleValues),
  notesAr: z.string().max(4000).nullable().optional(),
  notesId: z.string().max(4000).nullable().optional(),
})

type RouteCtx = { params: Promise<{ slug: string }> }

export const POST = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug } = validateParams(await ctx.params, paramsSchema)
  const body = await validateBody(req, createSchema)

  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!figure) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const battle = await db.query.battles.findFirst({
    where: and(eq(battles.id, body.battleId), isNull(battles.deletedAt)),
    columns: { id: true },
  })
  if (!battle) throw new ApiError('NOT_FOUND', `Battle not found: ${body.battleId}`)

  // Duplicate check — composite PK would 23505 but a clean 409 is friendlier.
  const dup = await db.query.battleParticipants.findFirst({
    where: and(
      eq(battleParticipants.battleId, body.battleId),
      eq(battleParticipants.figureId, figure.id),
    ),
  })
  if (dup) {
    throw new ApiError('CONFLICT', 'Tokoh sudah terdaftar pada peristiwa ini.', {
      fieldErrors: { battleId: 'Sudah terdaftar' },
    })
  }

  const [inserted] = await db
    .insert(battleParticipants)
    .values({
      battleId: body.battleId,
      figureId: figure.id,
      role: body.role,
      notesAr: body.notesAr ?? null,
      notesId: body.notesId ?? null,
    })
    .returning()
  if (!inserted) throw new ApiError('INTERNAL_ERROR', 'Gagal menyimpan peserta peristiwa.')

  await auditLog.write({
    action: 'create',
    resourceType: 'battle_participant',
    resourceId: battle.id,
    actorId: userId,
    diff: { after: inserted },
  })

  return created(inserted)
})
