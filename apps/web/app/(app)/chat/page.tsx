// AI Chat — `/chat`.
//
// Server entry. The `(app)` layout already verifies session + active
// subscription, so we delegate the entire experience to the client shell.
// Streaming requires the Node runtime (the chat API route is also
// `nodejs`); we mirror it here so the page is never statically optimised.
//
// We resolve the caller's roles here so the shell can show the "Mode Admin"
// banner without an extra round-trip. The chat API route does its own
// admin gating server-side — this is purely a UI hint.
//
// See docs/WIREFRAMES.md §15 (AI Chat) and docs/BACKEND.md §6.2.

import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { ChatShell } from '@/components/chat/chat-shell'
import { auth } from '@/lib/server/auth'
import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel limit: streaming chat responses can run up to 60s.
export const maxDuration = 60

export const metadata: Metadata = {
  title: 'AI Chat — Atsar',
  description: 'Tanya jawab seputar sirah dan tokoh salaf, bersumber.',
}

export default async function ChatPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userId = session?.user?.id
  let isAdmin = false
  if (userId) {
    const roles = await getUserRoleSlugs(userId)
    isAdmin = roles.has('admin')
  }
  return <ChatShell isAdmin={isAdmin} />
}
