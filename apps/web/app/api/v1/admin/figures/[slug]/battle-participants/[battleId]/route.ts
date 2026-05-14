// DELETE /api/v1/admin/figures/[slug]/battle-participants/[battleId]
//   → Remove this figure's participation in a battle.
//
// `battle_participants` has no soft-delete columns (composite-PK join table),
// so this is a hard DELETE.

import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@athar/db'
import { battleParticipants, figures } from '@athar/db/schema'

import { ApiError, noContent, validateParams, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import { auditLog } from '@/lib/server/services/audit.service'
import { slugSchema } from '@/lib/server/services/figure.schemas'

const paramsSchema = z.object({
  slug: slugSchema,
  battleId: z.string().uuid(),
})

type RouteCtx = { params: Promise<{ slug: string; battleId: string }> }

export const DELETE = withErrorHandling<RouteCtx>(async (req, ctx) => {
  const { userId } = await requirePermission(req, 'figures.update')
  const { slug, battleId } = validateParams(await ctx.params, paramsSchema)

  const figure = await db.query.figures.findFirst({
    where: and(eq(figures.slug, slug), isNull(figures.deletedAt)),
    columns: { id: true },
  })
  if (!figure) throw new ApiError('NOT_FOUND', `Figure not found: ${slug}`)

  const row = await db.query.battleParticipants.findFirst({
    where: and(
      eq(battleParticipants.battleId, battleId),
      eq(battleParticipants.figureId, figure.id),
    ),
  })
  if (!row) throw new ApiError('NOT_FOUND', 'Tokoh bukan peserta peristiwa ini.')

  await db
    .delete(battleParticipants)
    .where(
      and(
        eq(battleParticipants.battleId, battleId),
        eq(battleParticipants.figureId, figure.id),
      ),
    )

  await auditLog.write({
    action: 'hard_delete',
    resourceType: 'battle_participant',
    resourceId: battleId,
    actorId: userId,
    diff: { figureId: figure.id, battleId, role: row.role },
  })

  return noContent()
})
