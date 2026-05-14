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
// ── Architecture note (Bug #1 fix) ────────────────────────────────────────
// `useChat` lives inside <ConversationThread />, which is keyed by
// `activeId`. Switching/creating conversations fully remounts that subtree,
// so there is no stale-id window where the previous conversation's messages
// could be persisted under the newly-created activeId. The parent shell
// only owns the conversation list + which id is active; persistence is
// driven by an `onMessagesChange` callback fired from the inner mount that
// owns the id.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from 'ai/react'
import type { Message } from 'ai/react'
import { toast } from 'sonner'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { ConversationHistory } from './conversation-history'
import { MessageInput } from './message-input'
import { MessageList } from './message-list'
import {
  PROMPT_GUIDE_DISMISSED_KEY,
  PromptGuideDialog,
} from './prompt-guide-dialog'

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

interface ChatShellProps {
  /**
   * When true, the shell shows the admin-mode banner explaining that the
   * chat has access to write tools (discover/ingest). The actual gating is
   * server-side in `/api/v1/ai/chat`; this is purely a UI hint.
   */
  isAdmin?: boolean
}

export function ChatShell({ isAdmin = false }: ChatShellProps) {
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

  // ── Prompt-Guide dialog state ────────────────────────────────────────────
  // The dialog is always available via the "Panduan Prompt" button and the
  // global `?` shortcut. On first visit we auto-popup once; subsequent visits
  // respect the localStorage dismissal flag.
  const [guideOpen, setGuideOpen] = useState(false)

  // Auto-popup on first visit (after hydration, so SSR markup matches).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const dismissed = window.localStorage.getItem(PROMPT_GUIDE_DISMISSED_KEY)
      if (!dismissed) setGuideOpen(true)
    } catch {
      // Private mode / disabled storage — skip the popup silently.
    }
  }, [])

  // Persist dismissal whenever the user closes the dialog.
  const handleGuideOpenChange = useCallback((next: boolean) => {
    setGuideOpen(next)
    if (!next && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(PROMPT_GUIDE_DISMISSED_KEY, '1')
      } catch {
        // non-fatal
      }
    }
  }, [])

  // Global `?` (Shift+/) shortcut — ignored while typing in an input.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '?') return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }
      e.preventDefault()
      setGuideOpen((prev) => !prev)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // `initialMessages` is read once per <ConversationThread /> mount (because
  // we key it by `activeId`). That's exactly what we want — no stale reads
  // during streaming, no cross-contamination on switch.
  const initialMessages = useMemo<Message[]>(
    () => (activeConversation ? toSdkMessages(activeConversation.messages) : []),
    [activeConversation],
  )

  // ── 2. Persistence callback ──────────────────────────────────────────────
  // Fired by the inner thread on every messages change. Because the thread
  // is keyed by activeId, `id` here is guaranteed to match `messages`'
  // conversation — there is no stale-id window.
  const lastSavedRef = useRef<string>('')
  const handleMessagesChange = useCallback(
    (id: string, msgs: ReadonlyArray<Message>) => {
      if (!hydrated) return
      if (msgs.length === 0) return

      const storedMessages = toStored(msgs)
      const fingerprint = `${id}:${storedMessages.length}:${
        storedMessages[storedMessages.length - 1]?.content.length ?? 0
      }`
      // Skip redundant writes during streaming where only `content` grows
      // by less than 1 char — keep this cheap.
      if (fingerprint === lastSavedRef.current) return
      lastSavedRef.current = fingerprint

      setConversations((prev) => {
        const existing = prev.find((c) => c.id === id)
        const next: StoredConversation = {
          id,
          title: existing?.title ?? deriveTitle(storedMessages),
          updatedAt: new Date().toISOString(),
          messages: storedMessages,
        }
        const others = prev.filter((c) => c.id !== id)
        const updated = [next, ...others]
        saveConversations(updated)
        return updated
      })
    },
    [hydrated],
  )

  // ── 3. Conversation list actions ────────────────────────────────────────
  // No `stop()` or `setMessages([])` needed — remounting the keyed thread
  // throws away its `useChat` state (and aborts the fetch via the cleanup
  // inside the SDK).
  const handleNew = useCallback(() => {
    const id = makeConversationId()
    // Reset the persistence fingerprint so the new thread's first save
    // doesn't get debounced as a duplicate of the previous thread's tail.
    lastSavedRef.current = ''
    setActiveId(id)
  }, [])

  const handleSelect = useCallback(
    (id: string) => {
      if (id === activeId) return
      lastSavedRef.current = ''
      setActiveId(id)
    },
    [activeId],
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
        lastSavedRef.current = ''
        if (remaining.length > 0) {
          setActiveId(remaining[0]!.id)
        } else {
          setActiveId(makeConversationId())
        }
      }
    },
    [activeId, conversations],
  )

  // ── 4. Render ───────────────────────────────────────────────────────────
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
        <header className="flex items-center justify-between gap-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3">
          <h1 className="min-w-0 truncate text-sm font-semibold text-[rgb(var(--text))]">
            {activeConversation?.title ?? 'Percakapan baru'}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setGuideOpen(true)}
              aria-label="Buka panduan prompt"
              title="Panduan Prompt (?)"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Panduan Prompt</span>
            </Button>
            <Link
              href="/billing"
              className="text-xs text-[rgb(var(--text-muted))] hover:text-[rgb(var(--accent))]"
            >
              Sisa kuota →
            </Link>
          </div>
        </header>

        {isAdmin ? (
          <div
            className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-muted,var(--surface)))] px-4 py-2 text-xs text-[rgb(var(--text-muted))]"
            role="note"
          >
            <span className="font-semibold text-[rgb(var(--accent))]">
              Mode Admin
            </span>
            {' — '}
            kamu bisa minta AI untuk tambah/perbarui tokoh & perang via tool.
            Contoh:{' '}
            <span className="italic">
              &ldquo;Tambahkan semua shahabiyat pencerita hadits yang belum ada
              di database.&rdquo;
            </span>
          </div>
        ) : null}

        {/*
          Keyed by activeId — switching/creating a conversation fully remounts
          this subtree, which is what guarantees no cross-contamination of
          messages between conversations. See "Architecture note" at top.
        */}
        <ConversationThread
          key={activeId}
          conversationId={activeId}
          initialMessages={initialMessages}
          onMessagesChange={handleMessagesChange}
        />
      </main>

      <PromptGuideDialog
        isAdmin={isAdmin}
        open={guideOpen}
        onOpenChange={handleGuideOpenChange}
      />
    </div>
  )
}

// ─── Inner thread (owns useChat) ──────────────────────────────────────────

interface ConversationThreadProps {
  conversationId: string
  initialMessages: Message[]
  onMessagesChange: (id: string, msgs: ReadonlyArray<Message>) => void
}

function ConversationThread({
  conversationId,
  initialMessages,
  onMessagesChange,
}: ConversationThreadProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    error,
  } = useChat({
    api: '/api/v1/ai/chat',
    id: conversationId,
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

  // Push every messages change up to the shell. The parent debounces
  // identical fingerprints so this stays cheap during token streaming.
  useEffect(() => {
    onMessagesChange(conversationId, messages)
  }, [messages, conversationId, onMessagesChange])

  return (
    <>
      <MessageList messages={messages} isLoading={isLoading} error={error} />
      <MessageInput
        value={input}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        onStop={stop}
        isLoading={isLoading}
      />
    </>
  )
}
