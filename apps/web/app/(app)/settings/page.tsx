// Settings — `/settings`
//
// Server component. Loads the user's basic profile + preferences (so the
// initial tab does not flash empty), then mounts the four client tabs:
//   • Profile        — name/avatar/phone        (PATCH /users/me)
//   • Preferences    — locale/theme/calendar    (PATCH /users/me/preferences)
//   • Subscription   — current plan + quota     (read subscriptionsApi.me)
//   • Security       — password / 2FA / sessions
//
// The active tab is selected by the `?tab=` query param so deep-linking and
// "open in new window" work. Default tab is `profile`.
//
// See docs/WIREFRAMES.md §29.

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@athar/db'
import { users } from '@athar/db/schema'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ProfileTab } from '@/components/settings/profile-tab'
import { PreferencesTab } from '@/components/settings/preferences-tab'
import { SubscriptionTab } from '@/components/settings/subscription-tab'
import { SecurityTab } from '@/components/settings/security-tab'
import { auth } from '@/lib/server/auth'

type ValidTab = 'profile' | 'preferences' | 'subscription' | 'security'
const VALID: readonly ValidTab[] = ['profile', 'preferences', 'subscription', 'security'] as const

function pickTab(value: string | undefined): ValidTab {
  if (value && (VALID as readonly string[]).includes(value)) return value as ValidTab
  return 'profile'
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id
  if (!userId) redirect('/login')

  const sp = await searchParams
  const initialTab = pickTab(sp.tab)

  const row = await db.query.users.findFirst({
    where: and(eq(users.id, userId), isNull(users.deletedAt)),
    columns: {
      id: true,
      email: true,
      emailVerified: true,
      fullName: true,
      displayName: true,
      avatarUrl: true,
      phone: true,
      locale: true,
      themePreference: true,
      calendarPreference: true,
    },
  })

  if (!row) redirect('/login')

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="space-y-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Pengaturan
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Kelola profil, preferensi tampilan, langganan, dan keamanan akun Anda.
        </p>
      </header>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab
            initial={{
              email: row.email,
              emailVerified: row.emailVerified,
              fullName: row.fullName,
              displayName: row.displayName ?? '',
              avatarUrl: row.avatarUrl ?? '',
              phone: row.phone ?? '',
            }}
          />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab
            initial={{
              // DB enum includes 'en'; UI tabs only expose id/ar per WIREFRAMES §29.
              locale: row.locale === 'ar' ? 'ar' : 'id',
              theme: row.themePreference,
              calendar: row.calendarPreference,
            }}
          />
        </TabsContent>

        <TabsContent value="subscription">
          <SubscriptionTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
