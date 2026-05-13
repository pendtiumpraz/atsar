'use client'

// Left rail listing past chat conversations (WIREFRAMES §15).
//
// Pure presentational — all state lives in the parent <ChatShell/>.
// Items are pre-sorted by `updatedAt` desc by the caller. Each row shows
// the derived title and a relative timestamp; hover reveals a delete button.

import { useMemo } from 'react'
import { Plus, Trash2, MessageSquareText } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { StoredConversation } from './chat-shell'

interface ConversationHistoryProps {
  conversations: ReadonlyArray<StoredConversation>
  activeId: string
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

const RELATIVE_FORMATTER =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' })
    : null

function formatRelative(iso: string): string {
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return ''
  const diffSec = (ts - Date.now()) / 1000
  if (!RELATIVE_FORMATTER) return new Date(ts).toLocaleDateString('id-ID')

  const abs = Math.abs(diffSec)
  if (abs < 60) return RELATIVE_FORMATTER.format(Math.round(diffSec), 'second')
  if (abs < 3600)
    return RELATIVE_FORMATTER.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400)
    return RELATIVE_FORMATTER.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 86400 * 7)
    return RELATIVE_FORMATTER.format(Math.round(diffSec / 86400), 'day')
  return new Date(ts).toLocaleDateString('id-ID')
}

export function ConversationHistory({
  conversations,
  activeId,
  onNew,
  onSelect,
  onDelete,
}: ConversationHistoryProps) {
  const sorted = useMemo(
    () =>
      [...conversations].sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      ),
    [conversations],
  )

  return (
    <aside className="hidden border-r border-[rgb(var(--border))] bg-[rgb(var(--surface))] md:flex md:flex-col">
      <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-3 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Percakapan
        </h2>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex items-center gap-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 text-xs font-medium text-[rgb(var(--text))] transition-colors hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span>Baru</span>
        </button>
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 py-2"
        aria-label="Daftar percakapan"
      >
        {sorted.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-[rgb(var(--text-muted))]">
            Belum ada percakapan. Klik <strong>+ Baru</strong> untuk mulai.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sorted.map((c) => {
              const active = c.id === activeId
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
                      active
                        ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.10)] text-[rgb(var(--text))]'
                        : 'border-transparent text-[rgb(var(--text))] hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]',
                    )}
                    aria-current={active ? 'true' : undefined}
                  >
                    <MessageSquareText
                      className="mt-0.5 h-3.5 w-3.5 flex-none text-[rgb(var(--text-muted))]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {c.title}
                      </span>
                      <span className="mt-0.5 block text-[0.6rem] text-[rgb(var(--text-muted))]">
                        {formatRelative(c.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(c.id)
                    }}
                    className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-[rgb(var(--text-muted))] opacity-0 transition-opacity hover:bg-[rgb(var(--danger)/0.12)] hover:text-[rgb(var(--danger))] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] group-hover:opacity-100"
                    aria-label={`Hapus percakapan: ${c.title}`}
                    title="Hapus percakapan"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </nav>
    </aside>
  )
}
