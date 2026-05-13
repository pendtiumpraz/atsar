// DEV ONLY: bootstrap 3 sample users (admin / reviewer / subscriber) so the
// app is testable end-to-end without a real signup flow. Passwords are
// hashed with bcryptjs (Vercel-compatible) per the better-auth setup.
//
// Credentials seeded:
//   admin@atsar.local      / ChangeMe123!  → role: admin
//   reviewer@atsar.local   / ChangeMe123!  → role: reviewer  + reviewerProfile
//   subscriber@atsar.local / ChangeMe123!  → role: subscriber + active Premium trial
//
// Idempotent: skipped if any of the three emails already exist.
// Only invoked under `pnpm db:seed:dev` — not part of production seed.

import bcrypt from 'bcryptjs'
import { addDays } from 'date-fns'
import { eq } from 'drizzle-orm'

import { getSeedDb, logSeed } from './_helpers.js'
import {
  accounts,
  reviewerProfiles,
  roles,
  subscriptions,
  tiers,
  userRoles,
  users,
} from '../schema/index.js'

type DevUserSeed = {
  email: string
  fullName: string
  displayName: string
  roleSlug: 'admin' | 'reviewer' | 'subscriber'
  /** Optional tier slug to provision an active subscription for. */
  tierSlug?: 'free' | 'sampler' | 'basic' | 'pro' | 'premium'
  /** Reviewer-only extras. */
  reviewer?: {
    title: string
    bioId: string
    specialty: string[]
  }
}

const PASSWORD = 'ChangeMe123!' // shared dev-only password (NOT for production)

const SEEDS: DevUserSeed[] = [
  {
    email: 'admin@atsar.local',
    fullName: 'Admin Atsar',
    displayName: 'Admin',
    roleSlug: 'admin',
  },
  {
    email: 'reviewer@atsar.local',
    fullName: 'Ustadz Reviewer Demo',
    displayName: 'Ustadz Demo',
    roleSlug: 'reviewer',
    reviewer: {
      title: 'Ustadz',
      bioId:
        'Reviewer demo akun. Bertugas mereview konten biografi sebelum dipublikasikan.',
      specialty: ['rijal', 'sirah_perang'],
    },
  },
  {
    email: 'subscriber@atsar.local',
    fullName: 'Subscriber Demo',
    displayName: 'Subscriber',
    roleSlug: 'subscriber',
    tierSlug: 'premium',
  },
]

export async function seed028DevUsers() {
  const db = getSeedDb()

  // ── Resolve role + tier ids once ──────────────────────────────
  const allRoles = await db.select().from(roles)
  const roleBySlug = new Map(allRoles.map((r) => [r.slug, r.id]))

  const allTiers = await db.select().from(tiers)
  const tierBySlug = new Map(allTiers.map((t) => [t.slug, t.id]))

  let created = 0

  for (const seed of SEEDS) {
    // Skip if user already exists.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, seed.email))
      .limit(1)
    if (existing.length > 0) {
      console.log(`  ℹ ${seed.email} already exists — skipping`)
      continue
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 10)

    // 1. Create user
    const [user] = await db
      .insert(users)
      .values({
        email: seed.email,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        fullName: seed.fullName,
        displayName: seed.displayName,
        locale: 'id',
      })
      .returning()

    if (!user) {
      console.warn(`  ✗ failed to create ${seed.email}`)
      continue
    }

    // 2. Better-auth credential account.
    // NOTE: better-auth's credential provider stores `accountId = user.id`
    // (the user's UUID), NOT the email. The email→user lookup happens via
    // `users.email`; the account row is keyed by userId.
    await db.insert(accounts).values({
      userId: user.id,
      accountId: user.id,
      providerId: 'credential',
      password: passwordHash,
    })

    // 3. Assign role
    const roleId = roleBySlug.get(seed.roleSlug)
    if (roleId) {
      await db.insert(userRoles).values({ userId: user.id, roleId })
    } else {
      console.warn(`  ⚠ role ${seed.roleSlug} not found for ${seed.email}`)
    }

    // 4. Reviewer-specific profile
    if (seed.reviewer) {
      await db.insert(reviewerProfiles).values({
        userId: user.id,
        title: seed.reviewer.title,
        bioId: seed.reviewer.bioId,
        specialty: seed.reviewer.specialty,
        isActive: true,
        invitedAt: new Date(),
      })
    }

    // 5. Subscription (for subscriber demo)
    if (seed.tierSlug) {
      const tierId = tierBySlug.get(seed.tierSlug)
      if (tierId) {
        const now = new Date()
        await db.insert(subscriptions).values({
          userId: user.id,
          tierId,
          status: 'active',
          billingCycle: 'monthly',
          startedAt: now,
          expiresAt: addDays(now, 30),
          quotaResetAt: addDays(now, 30),
        })
      }
    }

    created++
    console.log(`  ✓ ${seed.email}  (${seed.roleSlug})`)
  }

  logSeed('dev_users', created, 'created')

  if (created > 0) {
    console.log(`\n  ───────── DEV CREDENTIALS (NOT FOR PRODUCTION) ─────────`)
    for (const s of SEEDS) {
      console.log(`    ${s.roleSlug.padEnd(11)}  ${s.email}   /   ${PASSWORD}`)
    }
    console.log(`  ─────────────────────────────────────────────────────────`)
  }
}
