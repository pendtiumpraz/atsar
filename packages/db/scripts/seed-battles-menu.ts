// One-shot script to insert the `admin-battles` menu item and grant access
// to the `admin` role, without running the full seeder pipeline.
//
// Run with: pnpm --filter @athar/db tsx scripts/seed-battles-menu.ts
//
// Idempotent: uses ON CONFLICT DO NOTHING on the menu_items insert and
// guards the role_menu_access insert with a lookup. Safe to re-run.

import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { and, eq } from 'drizzle-orm'
import * as schema from '../src/schema/index.js'

const url = process.env['DATABASE_URL_UNPOOLED'] ?? process.env['DATABASE_URL']
if (!url) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const client = postgres(url, { max: 5, prepare: false })
const db = drizzle(client, { schema })

async function main(): Promise<void> {
  // 1. Insert (or fetch) the menu_items row.
  const [inserted] = await db
    .insert(schema.menuItems)
    .values({
      slug: 'admin-battles',
      labelId: 'Sirah Perang',
      icon: 'Swords',
      path: '/admin/battles',
      displayOrder: 237,
      requiredPermission: 'battles.create',
      isActive: true,
    })
    .onConflictDoNothing()
    .returning()

  const menuItem =
    inserted ??
    (await db.query.menuItems.findFirst({
      where: eq(schema.menuItems.slug, 'admin-battles'),
    }))

  if (!menuItem) {
    console.error('failed to upsert admin-battles menu item')
    process.exit(1)
  }
  console.log(`  ✓ menu_items: admin-battles (${menuItem.id})`)

  // 2. Grant access to the admin role (defensive — the default seeder
  //    already gives admin ['*'] but a freshly-deployed env without seed
  //    needs this row explicitly).
  const adminRole = await db.query.roles.findFirst({
    where: eq(schema.roles.slug, 'admin'),
  })
  if (!adminRole) {
    console.error('admin role not found — run 001_roles seeder first')
    process.exit(1)
  }

  const existing = await db.query.roleMenuAccess.findFirst({
    where: and(
      eq(schema.roleMenuAccess.roleId, adminRole.id),
      eq(schema.roleMenuAccess.menuItemId, menuItem.id),
    ),
  })
  if (!existing) {
    await db
      .insert(schema.roleMenuAccess)
      .values({ roleId: adminRole.id, menuItemId: menuItem.id, canView: true })
    console.log(`  ✓ role_menu_access: admin → admin-battles`)
  } else {
    console.log(`  ✓ role_menu_access: already granted`)
  }

  await client.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
