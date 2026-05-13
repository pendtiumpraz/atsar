'use client'

// Atsar — AI role → model assignments.
//
// 5 roles (see aiRoleEnum in packages/db/schema/enums.ts):
//   chat, agent, doc_analyzer, avatar, embedding
//
// Seeded May 2026:
//   chat         → deepseek-v4-flash
//   agent        → deepseek-v4-flash
//   doc_analyzer → claude-sonnet-4-6 (memerlukan provider Anthropic aktif)
//   embedding    → text-embedding-3-large (memerlukan provider OpenAI aktif)
//   avatar       → (belum diset)
//
// API surface:
//   GET /api/v1/admin/ai-role-assignments → list current + active model options
//   PUT /api/v1/admin/ai-role-assignments  { role, modelId }

import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type AIRole = 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'

const ROLES: ReadonlyArray<{ value: AIRole; label: string; hint: string }> = [
  { value: 'chat', label: 'Chat', hint: 'Percakapan umum dengan pengguna.' },
  { value: 'agent', label: 'Agent', hint: 'Eksekusi tool-call & multi-step.' },
  {
    value: 'doc_analyzer',
    label: 'Doc Analyzer',
    hint: 'Long-form PDF / dokumen Arab.',
  },
  { value: 'avatar', label: 'Avatar', hint: 'Voice / video avatar generation.' },
  { value: 'embedding', label: 'Embedding', hint: 'Vektor untuk pencarian semantik.' },
]

interface ActiveModelOption {
  id: string
  providerName: string
  modelId: string
  displayName: string | null
}

interface AssignmentRow {
  role: AIRole
  modelId: string | null
  providerName: string | null
  modelDisplay: string | null
}

interface ApiResponse {
  assignments: AssignmentRow[]
  models: ActiveModelOption[]
}

export function RoleAssignments() {
  const [loading, setLoading] = React.useState(true)
  const [models, setModels] = React.useState<ActiveModelOption[]>([])
  const [assignments, setAssignments] = React.useState<Record<AIRole, AssignmentRow>>(() => ({
    chat: { role: 'chat', modelId: null, providerName: null, modelDisplay: null },
    agent: { role: 'agent', modelId: null, providerName: null, modelDisplay: null },
    doc_analyzer: {
      role: 'doc_analyzer',
      modelId: null,
      providerName: null,
      modelDisplay: null,
    },
    avatar: { role: 'avatar', modelId: null, providerName: null, modelDisplay: null },
    embedding: { role: 'embedding', modelId: null, providerName: null, modelDisplay: null },
  }))
  // Pending edits — modelId per role before user clicks "Simpan".
  const [draft, setDraft] = React.useState<Record<AIRole, string>>({
    chat: '',
    agent: '',
    doc_analyzer: '',
    avatar: '',
    embedding: '',
  })
  const [savingRole, setSavingRole] = React.useState<AIRole | null>(null)

  React.useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/admin/ai-role-assignments', {
          credentials: 'include',
        })
        if (!res.ok) throw new Error('Gagal memuat role assignments')
        const body = (await res.json()) as ApiResponse | { data?: ApiResponse }
        const data = 'data' in body && body.data ? body.data : (body as ApiResponse)
        if (cancel) return
        setModels(data.models ?? [])
        const next = { ...assignments }
        for (const a of data.assignments ?? []) {
          next[a.role] = a
        }
        setAssignments(next)
        // Seed draft with current selection.
        setDraft({
          chat: next.chat.modelId ?? '',
          agent: next.agent.modelId ?? '',
          doc_analyzer: next.doc_analyzer.modelId ?? '',
          avatar: next.avatar.modelId ?? '',
          embedding: next.embedding.modelId ?? '',
        })
      } catch (err) {
        if (!cancel) toast.error(err instanceof Error ? err.message : 'Gagal memuat role')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onSave(role: AIRole) {
    const modelId = draft[role]
    if (!modelId) {
      toast.error('Pilih model terlebih dahulu')
      return
    }
    setSavingRole(role)
    try {
      const res = await fetch('/api/v1/admin/ai-role-assignments', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, modelId }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan role')
      const selectedModel = models.find((m) => m.id === modelId)
      setAssignments((prev) => ({
        ...prev,
        [role]: {
          role,
          modelId,
          providerName: selectedModel?.providerName ?? null,
          modelDisplay: selectedModel?.displayName ?? selectedModel?.modelId ?? null,
        },
      }))
      toast.success(`Role ${role} disimpan`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan role')
    } finally {
      setSavingRole(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[rgb(var(--text-muted))]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat role assignments…
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-[rgb(var(--border))]">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
          <tr>
            <th className="px-3 py-2 font-medium">AI Role</th>
            <th className="px-3 py-2 font-medium">Model Aktif</th>
            <th className="px-3 py-2 font-medium">Provider</th>
            <th className="px-3 py-2 font-medium">Ganti</th>
            <th className="px-3 py-2 text-right font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {ROLES.map(({ value, label, hint }) => {
            const current = assignments[value]
            const draftValue = draft[value]
            const dirty = draftValue !== '' && draftValue !== (current.modelId ?? '')
            return (
              <tr
                key={value}
                className="border-t border-[rgb(var(--border))] align-middle hover:bg-[rgb(var(--bg-elevated))]"
              >
                <td className="px-3 py-3">
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-[rgb(var(--text-muted))]">{hint}</div>
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  {current.modelDisplay ?? (
                    <span className="text-[rgb(var(--text-muted))]">— (belum diset)</span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs">
                  {current.providerName ?? (
                    <span className="text-[rgb(var(--text-muted))]">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Select
                    value={draftValue}
                    onValueChange={(v) => setDraft((d) => ({ ...d, [value]: v }))}
                    disabled={savingRole === value}
                  >
                    <SelectTrigger className="w-[260px]">
                      <SelectValue placeholder="Pilih model aktif…" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.length === 0 ? (
                        <div className="px-2 py-3 text-xs text-[rgb(var(--text-muted))]">
                          Tidak ada model aktif. Aktifkan model dulu di tab "Semua Model".
                        </div>
                      ) : (
                        models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="font-mono text-xs">{m.modelId}</span>
                            <span className="ml-1 text-[rgb(var(--text-muted))]">
                              · {m.providerName}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-3 text-right">
                  <Button
                    size="sm"
                    onClick={() => onSave(value)}
                    disabled={!dirty || savingRole === value}
                  >
                    {savingRole === value ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    Simpan
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
