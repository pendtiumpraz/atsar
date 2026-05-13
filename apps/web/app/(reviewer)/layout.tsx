// Reviewer area shell — auth + reviewer role required.
//
// Reviewers moderate citation/figure submissions; they don't need an
// active subscription (compare with `(app)/layout.tsx`). Admins should
// also be allowed in — reviewer is a subset of admin capability.

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Navbar } from '@/components/organisms/navbar'
import { Sidebar } from '@/components/organisms/sidebar'
import { db } from '@athar/db'
import { roles, userRoles } from '@athar/db/schema'
import { auth } from '@/lib/server/auth'

async function userHasAnyRole(userId: string, slugs: string[]): Promise<boolean> {
  const rows = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), isNull(roles.deletedAt)))
    .where(and(eq(userRoles.userId, userId), inArray(roles.slug, slugs)))
    .limit(1)
  return rows.length > 0
}

export default async function ReviewerLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id

  if (!userId) {
    redirect('/login')
  }

  // Admins implicitly inherit reviewer capability.
  const allowed = await userHasAnyRole(userId, ['reviewer', 'admin'])
  if (!allowed) {
    redirect('/dashboard')
  }

  return (
    <div className="grid min-h-screen grid-cols-[auto_1fr] bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <Navbar />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
