// `/quiz/[slug]` — pre-attempt intro page (WIREFRAMES §14).
//
// Client component: the entire intro is rendered client-side so we can
// trigger `POST /api/v1/quizzes/[slug]/start` from the same component that
// renders the "Mulai Quiz" button — the auth cookie + redirect-to-attempt
// flow stay simple.  Quiz detail is fetched via TanStack Query (the same
// pattern Phase 4's figure detail uses for its tab content).
//
// Auth + subscription gating happens in `(app)/layout.tsx` upstream.

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { quizzesApi } from '@/lib/api/endpoints'

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
}

interface QuizDetailData {
  id: string
  slug: string
  titleId: string
  titleAr?: string | null
  descriptionId?: string | null
  descriptionAr?: string | null
  category?: string | null
  difficulty?: 'easy' | 'medium' | 'hard' | null
  durationSeconds?: number | null
  questions?: Array<{ id: string }>
}

interface StartResult {
  attemptId: string
  startedAt?: string
  totalQuestions?: number
  durationSeconds?: number | null
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  const mins = Math.round(seconds / 60)
  if (mins < 1) return `${seconds} detik`
  return `${mins} menit`
}

export default function QuizDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? ''
  const router = useRouter()

  const { data: quiz, isPending, isError, error } = useQuery<QuizDetailData>({
    queryKey: ['quiz', slug],
    queryFn: () => quizzesApi.getBySlug(slug) as Promise<QuizDetailData>,
    enabled: Boolean(slug),
  })

  const [isStarting, setIsStarting] = useState(false)

  async function handleStart() {
    if (!slug || isStarting) return
    setIsStarting(true)
    try {
      const result = (await quizzesApi.start(slug)) as StartResult
      if (!result?.attemptId) {
        throw new Error('Attempt ID tidak diterima dari server')
      }
      // Forward slug + startedAt so the attempt page can fetch quiz content
      // and run an accurate timer without a dedicated attempt-detail API.
      const qs = new URLSearchParams({ slug })
      if (result.startedAt) qs.set('startedAt', result.startedAt)
      router.push(`/quiz/attempts/${result.attemptId}?${qs.toString()}`)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Gagal memulai quiz. Coba lagi.'
      toast.error(message)
      setIsStarting(false)
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-64 animate-pulse rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]" />
      </div>
    )
  }

  if (isError || !quiz) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          role="alert"
          className="rounded-lg border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-4 text-sm text-[rgb(var(--danger))]"
        >
          Gagal memuat quiz.
          {error instanceof Error ? (
            <div className="mt-1 opacity-80">{error.message}</div>
          ) : null}
          <div className="mt-3">
            <Link
              href="/quiz"
              className="text-[rgb(var(--accent))] hover:underline"
            >
              ← Kembali ke daftar quiz
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalQuestions = quiz.questions?.length ?? 0
  const duration = formatDuration(quiz.durationSeconds)
  const difficultyLabel = quiz.difficulty
    ? (DIFFICULTY_LABEL[quiz.difficulty] ?? quiz.difficulty)
    : null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <nav className="text-sm text-[rgb(var(--text-faint))]">
        <Link href="/quiz" className="hover:underline">
          ← Kembali ke daftar quiz
        </Link>
      </nav>

      <article className="flex flex-col gap-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6">
        <header className="flex flex-col gap-2">
          {quiz.titleAr ? (
            <p
              lang="ar"
              dir="rtl"
              className="text-2xl text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-display-arab)' }}
            >
              {quiz.titleAr}
            </p>
          ) : null}
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            {quiz.titleId}
          </h1>
          <div className="flex flex-wrap gap-2">
            {quiz.category ? (
              <Badge variant="secondary">{quiz.category}</Badge>
            ) : null}
            {difficultyLabel ? (
              <Badge variant="outline">{difficultyLabel}</Badge>
            ) : null}
          </div>
        </header>

        {quiz.descriptionAr ? (
          <p
            lang="ar"
            dir="rtl"
            className="text-base leading-relaxed text-[rgb(var(--text-muted))]"
            style={{ fontFamily: 'var(--font-body-arab)' }}
          >
            {quiz.descriptionAr}
          </p>
        ) : null}
        {quiz.descriptionId ? (
          <p className="text-sm leading-relaxed text-[rgb(var(--text-muted))]">
            {quiz.descriptionId}
          </p>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-sm">
          <div>
            <dt className="text-xs text-[rgb(var(--text-faint))]">Jumlah Soal</dt>
            <dd className="text-base font-semibold text-[rgb(var(--text))]">
              {totalQuestions}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[rgb(var(--text-faint))]">Durasi</dt>
            <dd className="text-base font-semibold text-[rgb(var(--text))]">
              {duration ?? 'Tanpa batas waktu'}
            </dd>
          </div>
        </dl>

        <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-xs text-[rgb(var(--text-muted))]">
          Setelah dimulai, timer akan berjalan dan jawaban dikirim per soal.
          Pastikan koneksi Anda stabil sebelum memulai.
        </div>

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="primary"
            size="lg"
            disabled={totalQuestions === 0 || isStarting}
            onClick={handleStart}
          >
            {isStarting ? 'Memulai…' : 'Mulai Quiz'}
          </Button>
        </div>
      </article>
    </div>
  )
}
