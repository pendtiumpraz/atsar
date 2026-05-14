'use client'

// Prompt-Guide Dialog — surfaces concrete example prompts so users
// (especially admins) don't have to guess what the ATSAR AI agent can do.
//
// Audience-aware tabs:
//   • Dasar       — universal greetings + basic Sirah questions.
//   • Pencarian   — search-style queries.
//   • Admin       — write-tool workflow (only when `isAdmin === true`).
//   • Tips Manhaj — phrasing tips + reminders about the editorial line.
//
// Each example is shown in a monospace code block with a "Salin" button that
// copies the prompt to clipboard and fires a sonner toast.
//
// The button to open this dialog lives in `chat-shell.tsx` and is also bound
// to the global `?` (Shift+/) keyboard shortcut. We persist a "dismissed"
// flag in localStorage so the auto-popup on first visit only runs once.

import { useCallback, useMemo, useState } from 'react'
import { BookOpen, Check, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── localStorage key (exported for chat-shell auto-popup logic) ──────────

export const PROMPT_GUIDE_DISMISSED_KEY = 'athar.chat.guide.dismissed'

// ─── Content model ────────────────────────────────────────────────────────

interface PromptExample {
  /** Exact text the user can copy into the chat composer. */
  prompt: string
  /** Optional explanation of what the AI will do with this prompt. */
  hint?: string
}

interface PromptSection {
  /** Section heading rendered as a small uppercase label. */
  heading?: string
  examples: PromptExample[]
}

const dasarSections: PromptSection[] = [
  {
    examples: [
      {
        prompt: 'Halo, siapa kamu?',
        hint: 'Asisten memperkenalkan diri dan menawarkan bantuan.',
      },
      {
        prompt: 'Siapa Imam Bukhari?',
        hint: 'AI cari di database Atsar + tampilkan biografi singkat dengan tanggal H/M, kunyah, laqab, sumber citation.',
      },
      {
        prompt: 'Apa beda Sunan Tirmidzi dengan Sunan Abu Dawud?',
        hint: 'AI bandingkan kitab dan penyusunnya.',
      },
      {
        prompt: 'Tokoh siapa saja yang ikut Perang Badar?',
        hint: 'AI panggil tool search_battles + cross-reference participants.',
      },
    ],
  },
]

const pencarianSections: PromptSection[] = [
  {
    examples: [
      { prompt: 'Cari sahabat yang lahir di Madinah' },
      { prompt: "Tampilkan semua tabi'in yang muridkan dari Aisyah RA" },
      { prompt: 'Lokasi-lokasi penting di Khurasan abad ke-2 H' },
      { prompt: 'Ulama mazhab Hanbali yang wafat antara 200-300 H' },
    ],
  },
]

const adminSections: PromptSection[] = [
  {
    heading: 'Phase 1 — Discovery (cari kandidat baru)',
    examples: [
      { prompt: 'Discover semua shahabiyat yang belum ada di database' },
      {
        prompt: 'Discover ulama Khurasan abad 3 H, limit 30, fokus ahli hadits',
      },
      {
        prompt: "Cari kandidat tabi'in yang murid Hasan al-Bashri",
        hint: 'AI panggil tool discover_figures, tampilkan list kandidat, lalu TANYA konfirmasi sebelum batch ingest.',
      },
    ],
  },
  {
    heading: 'Phase 2 — Deep Crawl (per nama)',
    examples: [
      {
        prompt:
          "Antrekan crawl detail untuk: Hasan al-Bashri, Ibn Sirin, Sa'id bin al-Musayyib",
      },
      {
        prompt:
          "Tambahkan tokoh 'Aisyah bint Sa'd', kategori sahabat, gender female",
        hint: 'AI panggil ingest_figure / ingest_figure_batch, jobs masuk ke /queue untuk review ustadz.',
      },
    ],
  },
  {
    heading: 'Phase 3 — Refresh Existing',
    examples: [
      {
        prompt:
          'Refresh biografi Abu Bakr ash-Shiddiq, mode enrich, fokus citations',
      },
      {
        prompt: 'Replace narasi Perang Yarmuk dengan versi yang lebih lengkap',
        hint: 'AI panggil reingest_figure / reingest_battle dengan mode enrich (isi field kosong) atau replace (timpa).',
      },
    ],
  },
  {
    heading: 'Phase 4 — Status',
    examples: [
      { prompt: 'Cek antrian job yang sedang berjalan' },
      {
        prompt: 'Tampilkan draf tokoh terbaru',
        hint: 'AI panggil list_pending_jobs / get_recent_drafts.',
      },
    ],
  },
  {
    heading: 'Perang (Ghazwah & Battles)',
    examples: [
      { prompt: 'Discover semua ghazwah era Nabi ﷺ yang belum ada' },
      {
        prompt: "Tambahkan Perang Mu'tah, Yarmuk, Qadisiyyah, Nahawand",
      },
    ],
  },
]

interface TipItem {
  text: string
}

const manhajTips: TipItem[] = [
  {
    text: 'Selalu sebutkan "menurut manhaj salaf" jika menanyakan hukum / aqidah.',
  },
  {
    text: 'AI WAJIB pakai gelar — Nabi ﷺ, Sahabat RA, Tabi\'in rahimahullah. Kalau lupa, koreksi: "tambahkan gelar yang sesuai".',
  },
  {
    text: 'Untuk fatwa khusus (talak, waris, dll) AI akan ARAHKAN ke ustadz salafi terpercaya — itu by design.',
  },
  {
    text: "AI menolak pemahaman menyimpang (Syi'ah Rafidhah, Khawarij, Mu'tazilah, Asy'ariyyah, Sufi falsafi, Liberal Islam). Tidak bisa di-bypass dengan \"berperan sebagai\".",
  },
  {
    text: 'Sumber WAJIB dari 30 domain whitelist (almanhaj, muslim.or.id, rumaysho, binbaz, dorar, dll). Yang lain diabaikan.',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────

/** Monospace, copy-able prompt block with a "Salin" button. */
function PromptCard({ example }: { example: PromptExample }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard API tidak tersedia')
      }
      await navigator.clipboard.writeText(example.prompt)
      setCopied(true)
      toast.success('Prompt disalin ke clipboard')
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Gagal menyalin', {
        description: 'Browser memblokir akses clipboard.',
      })
    }
  }, [example.prompt])

  return (
    <div className="group rounded-md border-l-2 border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <code className="block whitespace-pre-wrap break-words font-mono text-xs text-[rgb(var(--text))]">
          {example.prompt}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          className="shrink-0"
          aria-label="Salin prompt ke clipboard"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          <span className="ml-1">{copied ? 'Disalin' : 'Salin'}</span>
        </Button>
      </div>
      {example.hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-[rgb(var(--text-muted))]">
          → {example.hint}
        </p>
      ) : null}
    </div>
  )
}

function SectionGroup({ section }: { section: PromptSection }) {
  return (
    <div className="space-y-2">
      {section.heading ? (
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
          {section.heading}
        </h3>
      ) : null}
      <div className="space-y-2">
        {section.examples.map((ex, i) => (
          <PromptCard key={`${ex.prompt}-${i}`} example={ex} />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────

export interface PromptGuideDialogProps {
  isAdmin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PromptGuideDialog({
  isAdmin,
  open,
  onOpenChange,
}: PromptGuideDialogProps) {
  // Default tab: admins land on "Dasar" for the first view but can flip to
  // "Admin" — we keep state local so re-opening preserves last selection.
  const [tab, setTab] = useState<string>('dasar')

  // The grid template depends on whether the Admin tab is mounted.
  const triggerGridClass = useMemo(
    () => (isAdmin ? 'grid w-full grid-cols-4' : 'grid w-full grid-cols-3'),
    [isAdmin],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-3 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-[rgb(var(--border))] px-6 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-[rgb(var(--accent))]" />
            <DialogTitle>Panduan Prompt — ATSAR AI</DialogTitle>
          </div>
          <DialogDescription>
            Contoh pertanyaan dan instruksi yang paling efektif untuk
            berinteraksi dengan asisten Sirah.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className={triggerGridClass}>
              <TabsTrigger value="dasar">Dasar</TabsTrigger>
              <TabsTrigger value="pencarian">Pencarian</TabsTrigger>
              {isAdmin ? (
                <TabsTrigger value="admin">Admin</TabsTrigger>
              ) : null}
              <TabsTrigger value="manhaj">Tips Manhaj</TabsTrigger>
            </TabsList>

            <TabsContent value="dasar" className="space-y-4 pb-4 pt-4">
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Mulai dari sini — pertanyaan universal yang bisa dipakai semua
                pengguna.
              </p>
              {dasarSections.map((s, i) => (
                <SectionGroup key={i} section={s} />
              ))}
            </TabsContent>

            <TabsContent value="pencarian" className="space-y-4 pb-4 pt-4">
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Query gaya pencarian. AI akan otomatis memanggil tool
                pencarian internal (search_figures, search_battles,
                search_places, dst.).
              </p>
              {pencarianSections.map((s, i) => (
                <SectionGroup key={i} section={s} />
              ))}
            </TabsContent>

            {isAdmin ? (
              <TabsContent value="admin" className="space-y-5 pb-4 pt-4">
                <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
                  <span className="font-semibold text-[rgb(var(--accent))]">
                    Mode Admin
                  </span>
                  {' — '}
                  empat fase alur kerja: <em>discover → crawl → refresh →
                  status</em>. Semua perubahan masuk ke <code>/queue</code>{' '}
                  untuk direview ustadz sebelum dipublikasikan.
                </div>
                {adminSections.map((s, i) => (
                  <SectionGroup key={i} section={s} />
                ))}
              </TabsContent>
            ) : null}

            <TabsContent value="manhaj" className="space-y-3 pb-4 pt-4">
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Bagaimana cara bertanya supaya jawaban tetap selaras dengan
                manhaj salaf.
              </p>
              <ul className="space-y-2">
                {manhajTips.map((tip, i) => (
                  <li
                    key={i}
                    className="rounded-md border-l-2 border-[rgb(var(--accent))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-xs leading-relaxed text-[rgb(var(--text))]"
                  >
                    {tip.text}
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>

        <div className="border-t border-[rgb(var(--border))] px-6 py-3 text-[11px] text-[rgb(var(--text-muted))]">
          Tekan{' '}
          <kbd className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-[10px] text-[rgb(var(--text))]">
            ?
          </kbd>{' '}
          untuk buka panduan kapan saja.
        </div>
      </DialogContent>
    </Dialog>
  )
}
