import { eq } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import { roles, permissions, rolePermissions } from '../schema/index.js'

// Default role → permission matrix per BACKEND.md §5.5.
const MATRIX: Record<string, string[]> = {
  admin: [
    'figures.view',
    'figures.create',
    'figures.update',
    'figures.delete',
    'figures.publish',
    'figures.review',
    'battles.view',
    'battles.create',
    'battles.update',
    'battles.delete',
    'battles.publish',
    'trash.view',
    'trash.restore',
    'trash.hard_delete',
    'ai.chat',
    'ai.agent.use',
    'ai.doc_analyzer.use',
    'ai_providers.manage',
    'ai_models.manage',
    'users.view',
    'users.invite',
    'users.update',
    'users.delete',
    'users.set_role',
    'roles.manage',
    'permissions.manage',
    'menu.manage',
    'subscriptions.view',
    'subscriptions.activate',
    'payments.confirm',
    'fonts.view',
    'fonts.manage',
    'fonts.activate',
    'whitelist.manage',
    'pdf.export',
    'pdf.export_custom',
    'quiz.attempt',
    'quiz.manage',
    'audit_log.view',
  ],
  reviewer: [
    'figures.view',
    'figures.review',
    'battles.view',
    'ai.chat',
    'trash.view',
    'pdf.export',
    'quiz.attempt',
    'audit_log.view',
  ],
  subscriber: [
    'figures.view',
    'battles.view',
    'ai.chat',
    'pdf.export',
    'quiz.attempt',
  ],
}

export async function seed003RolePermissions() {
  const db = getSeedDb()
  let total = 0
  for (const [roleSlug, permSlugs] of Object.entries(MATRIX)) {
    const [role] = await db.select().from(roles).where(eq(roles.slug, roleSlug)).limit(1)
    if (!role) {
      console.warn(`  ⚠ role not found: ${roleSlug}`)
      continue
    }
    for (const permSlug of permSlugs) {
      const [perm] = await db
        .select()
        .from(permissions)
        .where(eq(permissions.slug, permSlug))
        .limit(1)
      if (!perm) {
        console.warn(`  ⚠ permission not found: ${permSlug}`)
        continue
      }
      await db
        .insert(rolePermissions)
        .values({ roleId: role.id, permissionId: perm.id })
        .onConflictDoNothing()
      total++
    }
  }
  logSeed('role_permissions', total)
}
