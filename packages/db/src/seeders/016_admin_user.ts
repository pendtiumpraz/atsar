// Bootstrap initial admin user from env (SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME).
// Idempotent: skip if email already exists.

import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { getSeedDb, logSeed } from './_helpers.js'
import { users, roles, userRoles } from '../schema/index.js'

function simpleHashPlaceholder(password: string): string {
  // PLACEHOLDER: production should use argon2id via better-auth.
  // For now use scrypt (built-in) so we don't add a dep yet.
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, 64)
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function seed016AdminUser() {
  const db = getSeedDb()
  const email = process.env['SEED_ADMIN_EMAIL']
  const password = process.env['SEED_ADMIN_PASSWORD']
  const fullName = process.env['SEED_ADMIN_NAME'] ?? 'Athar Admin'

  if (!email || !password) {
    console.warn('  ⚠ SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin seed')
    console.warn('    (set them in .env.local then run `pnpm db:seed` again to bootstrap)')
    return
  }

  // Skip if user exists.
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) {
    console.log(`  ℹ admin "${email}" already exists — skipping`)
    return
  }

  const [admin] = await db
    .insert(users)
    .values({
      email,
      emailVerifiedAt: new Date(),
      passwordHash: simpleHashPlaceholder(password),
      fullName,
      displayName: fullName,
      locale: 'id',
    })
    .returning()

  if (!admin) {
    console.error('  ✗ failed to create admin user')
    return
  }

  // Assign admin role.
  const [adminRole] = await db.select().from(roles).where(eq(roles.slug, 'admin')).limit(1)
  if (!adminRole) {
    console.error('  ✗ admin role not found — run 001_roles first')
    return
  }
  await db.insert(userRoles).values({ userId: admin.id, roleId: adminRole.id })

  logSeed('admin_user', 1, `created (${email})`)
}
