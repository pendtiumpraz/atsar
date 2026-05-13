// AI Chat — `/chat`.
//
// Server entry. The `(app)` layout already verifies session + active
// subscription, so we delegate the entire experience to the client shell.
// Streaming requires the Node runtime (the chat API route is also
// `nodejs`); we mirror it here so the page is never statically optimised.
//
// See docs/WIREFRAMES.md §15 (AI Chat) and docs/BACKEND.md §6.2.

import type { Metadata } from 'next'

import { ChatShell } from '@/components/chat/chat-shell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Vercel limit: streaming chat responses can run up to 60s.
export const maxDuration = 60

export const metadata: Metadata = {
  title: 'AI Chat — Atsar',
  description: 'Tanya jawab seputar sirah dan tokoh salaf, bersumber.',
}

export default function ChatPage() {
  return <ChatShell />
}
