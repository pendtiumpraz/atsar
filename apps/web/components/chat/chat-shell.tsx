'use client'

// AI Chat shell — orchestrates conversation history + Vercel AI SDK streaming.
//
// Layout (WIREFRAMES §15): left rail of conversations, right pane with the
// message transcript and the composer.
//
// Persistence is **client-only** for Phase 5. Each conversation is stored in
// localStorage under `athar.chat.v1.conversations`. When the backend gains a
// `conversations` table we will swap this hook out for TanStack Query without
// touching the child components.
//
// The composer/transcript talk to `POST /api/v1/ai/chat` (Vercel AI SDK
// `streamText` → `toDataStreamResponse`). We pass the `conversationId` as
// `useChat`'s `id` so React swaps the underlying chat state when the user
// jumps between conversations.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from 'ai/react'
import type { Message } from 'ai/react'
import { toast } from 'sonner'
import Link from 'next/link'

import { ConversationHistory } from './conversation-history'
import { MessageInput } from './message-input'
import { MessageList } from './message-list'

// ─── localStorage shape ───────────────────────────────────────────────────

/** Persisted message — keep it small: only what we need to rehydrate the UI. */
export interface StoredMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  /** ISO string — `Date` isn't JSON-serialisable. */
  createdAt?: string
}

export interface StoredConversation {
  id: string
  title: string
  /** ISO timestamp of last activity. Sort key for the sidebar. */
  updatedAt: string
  messages: StoredMessage[]
}

const STORAGE_KEY = 'athar.chat.v1.conversations'

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeConversationId(): string {
  // `crypto.randomUUID` is available in all evergreen browsers and Node ≥19.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Title heuristic: trim first user message to ~48 chars, no trailing punctuation. */
function deriveTitle(messages: ReadonlyArray<StoredMessage | Message>): string {
  const firstUser = messages.find((m) => m.role === 'user')
  const text = typeof firstUser?.content === 'string' ? firstUser.content : ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'Percakapan baru'
  return cleaned.length > 48 ? `${cleaned.slice(0, 47)}…` : cleaned
}

function loadConversations(): StoredConversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    // Light defensive validation — drop entries that don't match shape.
    return parsed.filter(
      (c): c is StoredConversation =>
        !!c &&
        typeof (c as StoredConversation).id === 'string' &&
        Array.isArray((c as StoredConversation).messages),
    )
  } catch {
    return []
  }
}

function saveConversations(list: ReadonlyArray<StoredConversation>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Quota / private-mode failures are non-fatal; chat still works in-memory.
  }
}

function toStored(messages: ReadonlyArray<Message>): StoredMessage[] {
  return messages.map((m) => ({
    id: m.id,
    // `data` role exists in the SDK but our API only accepts the 3 standard roles.
    role: m.role === 'data' ? 'assistant' : m.role,
    content: m.content,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : undefined,
  }))
}

function toSdkMessages(messages: ReadonlyArray<StoredMessage>): Message[] {
  return messages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt ? new Date(m.createdAt) : undefined,
  }))
}

// ─── Component ────────────────────────────────────────────────────────────

export function ChatShell() {
  // Conversation list (hydrates from localStorage on mount — keep [] on SSR
  // so the server-rendered markup matches the first client paint).
  const [conversations, setConversations] = useState<StoredConversation[]>([])
  const [activeId, setActiveId] = useState<string>(() => makeConversationId())
  const [hydrated, setHydrated] = useState(false)

  // ── 1. Hydrate from localStorage once on mount ───────────────────────────
  useEffect(() => {
    const stored = loadConversations()
    setConversations(stored)
    if (stored.length > 0) {
      // Sort by updatedAt desc and pick the most recent as the active one.
      const sorted = [...stored].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      )
      setActiveId(sorted[0]!.id)
    }
    setHydrated(true)
  }, [])

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId),
    [conversations, activeId],
  )

  const initialMessages = useMemo<Message[]>(
    () => (activeConversation ? toSdkMessages(activeConversation.messages) : []),
    [activeConversation],
  )

  // ── 2. Wire up the Vercel AI SDK ─────────────────────────────────────────
  // Re-keying via `id` resets `useChat`'s internal state when the user picks a
  // different conversation. `initialMessages` is read once per id.
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setMessages,
    error,
  } = useChat({
    api: '/api/v1/ai/chat',
    id: activeId,
    initialMessages,
    onError: (err) => {
      // Surface server errors as toasts. The route returns JSON for failures
      // before the stream starts; the SDK wraps them as `Error` with the body
      // as `message`. We try to parse it for a friendlier label.
      let message = err.message || 'Gagal menghubungi AI Chat'
      let code: string | undefined
      try {
        const parsed = JSON.parse(err.message) as {
          error?: { code?: string; message?: string }
        }
        if (parsed?.error?.message) message = parsed.error.message
        code = parsed?.error?.code
      } catch {
        /* keep default */
      }
      if (code === 'QUOTA_EXCEEDED' || code === 'PAYMENT_REQUIRED') {
        toast.error('Kuota AI Chat habis', {
          description: message,
          action: {
            label: 'Lihat tagihan',
            onClick: () => {
              window.location.href = '/billing'
            },
          },
        })
      } else {
        toast.error('AI Chat error', { description: message })
      }
    },
  })

  // ── 3. Persist on every message change ──────────────────────────────────
  // We only write once hydration is done so we don't blow away storage with
  // the empty SSR state.
  const lastSavedRef = useRef<string>('')
  useEffect(() => {
    if (!hydrated) return
    if (messages.length === 0) return

    const storedMessages = toStored(messages)
    const fingerprint = `${activeId}:${storedMessages.length}:${
      storedMessages[storedMessages.length - 1]?.content.length ?? 0
    }`
    // Skip redundant writes during streaming where only `content` grows.
    if (fingerprint === lastSavedRef.current) return
    lastSavedRef.current = fingerprint

    setConversations((prev) => {
      const existing = prev.find((c) => c.id === activeId)
      const next: StoredConversation = {
        id: activeId,
        title: existing?.title ?? deriveTitle(storedMessages),
        updatedAt: new Date().toISOString(),
        messages: storedMessages,
      }
      const others = prev.filter((c) => c.id !== activeId)
      const updated = [next, ...others]
      saveConversations(updated)
      return updated
    })
  }, [messages, activeId, hydrated])

  // ── 4. Conversation list actions ────────────────────────────────────────
  const handleNew = useCallback(() => {
    stop() // abort any in-flight stream on the previous conversation
    const id = makeConversationId()
    setActiveId(id)
    setMessages([])
  }, [setMessages, stop])

  const handleSelect = useCallback(
    (id: string) => {
      if (id === activeId) return
      stop()
      setActiveId(id)
      // `useChat` re-reads `initialMessages` when `id` changes, but the
      // current React state would briefly show the old messages — clear it.
      setMessages([])
    },
    [activeId, setMessages, stop],
  )

  const handleDelete = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const updated = prev.filter((c) => c.id !== id)
        saveConversations(updated)
        return updated
      })
      if (id === activeId) {
        const remaining = conversations.filter((c) => c.id !== id)
        if (remaining.length > 0) {
          setActiveId(remaining[0]!.id)
        } else {
          setActiveId(makeConversationId())
        }
        setMessages([])
      }
    },
    [activeId, conversations, setMessages],
  )

  // ── 5. Render ───────────────────────────────────────────────────────────
  // 56px = navbar height (see organisms/navbar) — match the wireframe rail.
  return (
    <div className="-m-4 grid h-[calc(100vh-56px)] grid-cols-1 md:-m-6 md:grid-cols-[260px_1fr]">
      <ConversationHistory
        conversations={conversations}
        activeId={activeId}
        onNew={handleNew}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />
      <main className="flex min-h-0 flex-col bg-[rgb(var(--bg))]">
        <header className="flex items-center justify-between border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
          <h1 className="text-sm font-semibold text-[rgb(var(--text))]">
            {activeConversation?.title ?? 'Percakapan baru'}
          </h1>
          <Link
            href="/billing"
            className="text-xs text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))]"
          >
            Sisa kuota →
          </Link>
        </header>

        <MessageList messages={messages} isLoading={isLoading} error={error} />

        <MessageInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onStop={stop}
          isLoading={isLoading}
        />
      </main>
    </div>
  )
}
