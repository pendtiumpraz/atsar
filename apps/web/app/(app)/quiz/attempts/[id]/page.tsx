// `/quiz/attempts/[id]` — active quiz session (WIREFRAMES §14).
//
// Client component: owns the per-question navigation state and the timer.
// On mount we need the quiz content (questions + options), but the attempt
// itself only knows its id. The user landed here from `/quiz/[slug]` where
// the slug is naturally known — we forward it via the `?slug=` search param
// during the redirect.  As a safety net the page also accepts `?slug=` from
// any external deep link.
//
// Submit flow:
//   - On every "Lanjut" press we fire `POST /attempts/:id/answer` with the
//     current selection (fire-and-forget; failures show a toast).
//   - On "Submit" we re-send the final question's answer (if dirty) then
//     `POST /attempts/:id/complete`, then redirect to the result page with
//     `?score=&total=&slug=` so the result view can render without a
//     dedicated attempt-detail API.
//   - The timer auto-submits if it reaches zero.

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { QuizSession } from '@/components/quiz/quiz-session'
import { QuizTimer } from '@/components/quiz/quiz-timer'
import { quizzesApi } from '@/lib/api/endpoints'

interface QuizDetailData {
  id: string
  slug: string
  titleId: string
  titleAr?: string | null
  durationSeconds?: number | null
  questions: Array<{
    id: string
    questionOrder: number
    questionAr?: string | null
    questionId: string
    points: number
    options: Array<{
      id: string
      optionOrder: number
      textAr?: string | null
      textId: string
    }>
  }>
}

interface CompleteResult {
  attemptId?: string
  score?: number
  totalQuestions?: number
  correctCount?: number
  completedAt?: string
}

export default function QuizAttemptPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const attemptId = params?.id ?? ''
  const slug = searchParams.get('slug') ?? ''
  // The timer needs a stable startedAt — capture it on first render so the
  // server time used at /start is preserved. If a `startedAt=` query param
  // was provided (set by the start redirect) we trust it; otherwise we
  // fall back to now-on-mount which is best-effort.
  const startedAtParam = searchParams.get('startedAt')
  const startedAtRef = useRef<string>(
    startedAtParam || new Date().toISOString(),
  )

  // Quiz content (questions + options). Without a slug we can't fetch — fall
  // back to a recoverable error state with a "Pilih Quiz" link.
  const {
    data: quiz,
    isPending,
    isError,
    error,
  } = useQuery<QuizDetailData>({
    queryKey: ['quiz', slug],
    queryFn: () => quizzesApi.getBySlug(slug) as Promise<QuizDetailData>,
    enabled: Boolean(slug),
    staleTime: 60_000,
  })

  const questions = useMemo(() => quiz?.questions ?? [], [quiz?.questions])
  const total = questions.length

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Map<string, string>>(() => new Map())
  // The id of the answer last sent to the server — used to avoid resending
  // the same (questionId, optionId) pair on every navigation.
  const sentRef = useRef<Map<string, string>>(new Map())
  const [isBusy, setIsBusy] = useState(false)
  const completedRef = useRef(false)

  const currentQuestion = questions[index]
  const currentSelection = currentQuestion
    ? (answers.get(currentQuestion.id) ?? null)
    : null

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!currentQuestion) return
      setAnswers((prev) => {
        const next = new Map(prev)
        next.set(currentQuestion.id, optionId)
        return next
      })
    },
    [currentQuestion],
  )

  /**
   * Fire-and-forget single-answer submit. Skips when the selection hasn't
   * changed since the last send. Failures surface as a toast — the user can
   * proceed and we'll retry the same payload on the next nav.
   */
  const sendAnswer = useCallback(
    async (questionId: string, optionId: string | null) => {
      if (!attemptId) return
      const previously = sentRef.current.get(questionId)
      if (previously === (optionId ?? '')) return
      try {
        await quizzesApi.answer(attemptId, {
          questionId,
          // The HTTP route expects `selectedOptionId`. `endpoints.ts` types
          // the body loosely as `{ questionId, answer: unknown }` so we
          // sneak through the correct field name — the server validates
          // `selectedOptionId` via `submitAnswerSchema`.
          answer: optionId,
          selectedOptionId: optionId,
        } as unknown as { questionId: string; answer: unknown })
        sentRef.current.set(questionId, optionId ?? '')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal menyimpan jawaban.'
        toast.error(message)
      }
    },
    [attemptId],
  )

  const completeAndRedirect = useCallback(async () => {
    if (!attemptId || completedRef.current) return
    completedRef.current = true
    setIsBusy(true)
    try {
      const result = (await quizzesApi.complete(attemptId)) as CompleteResult
      const score = result?.score ?? 0
      const totalQuestions = result?.totalQuestions ?? total
      const correctCount = result?.correctCount ?? 0
      const qs = new URLSearchParams({
        score: String(score),
        total: String(totalQuestions),
        correct: String(correctCount),
      })
      if (slug) qs.set('slug', slug)
      router.replace(`/quiz/attempts/${attemptId}/result?${qs.toString()}`)
    } catch (err) {
      completedRef.current = false
      const message =
        err instanceof Error ? err.message : 'Gagal menyelesaikan quiz.'
      toast.error(message)
      setIsBusy(false)
    }
  }, [attemptId, router, slug, total])

  /**
   * Auto-submit when the timer expires. Send the current selection first
   * (best-effort) so the score reflects the last picked answer.
   */
  const handleExpire = useCallback(() => {
    if (completedRef.current) return
    toast.warning('Waktu habis. Jawaban dikirim otomatis.')
    if (currentQuestion) {
      void sendAnswer(currentQuestion.id, currentSelection)
    }
    void completeAndRedirect()
  }, [completeAndRedirect, currentQuestion, currentSelection, sendAnswer])

  // ── Render gates ────────────────────────────────────────────────────
  if (!attemptId) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBox message="Attempt tidak valid." />
      </div>
    )
  }

  if (!slug) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBox message="Slug quiz tidak diketahui. Mulai dari halaman quiz." />
      </div>
    )
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
        <ErrorBox
          message={
            error instanceof Error
              ? `Gagal memuat soal: ${error.message}`
              : 'Gagal memuat soal.'
          }
        />
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBox message="Quiz ini belum memiliki soal." />
      </div>
    )
  }

  if (!currentQuestion) {
    // Defensive — shouldn't happen because we cap `index` below.
    return null
  }

  const handlePrev = () => {
    if (index === 0 || isBusy) return
    setIndex((i) => Math.max(0, i - 1))
  }

  const handleNext = async () => {
    if (isBusy) return
    if (currentSelection) {
      // Fire-and-forget — don't block the UI.
      void sendAnswer(currentQuestion.id, currentSelection)
    }
    setIndex((i) => Math.min(total - 1, i + 1))
  }

  const handleSubmit = async () => {
    if (isBusy) return
    setIsBusy(true)
    // Ensure the last answer is sent (synchronously, so the score is
    // accurate when complete runs). Errors surface as a toast but we still
    // attempt to complete — partial scores are better than a stuck attempt.
    if (currentSelection) {
      try {
        await quizzesApi.answer(attemptId, {
          questionId: currentQuestion.id,
          answer: currentSelection,
          selectedOptionId: currentSelection,
        } as unknown as { questionId: string; answer: unknown })
        sentRef.current.set(currentQuestion.id, currentSelection)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal menyimpan jawaban terakhir.'
        toast.error(message)
      }
    }
    await completeAndRedirect()
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            {quiz.titleId}
          </h1>
          {quiz.titleAr ? (
            <p
              lang="ar"
              dir="rtl"
              className="text-sm text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {quiz.titleAr}
            </p>
          ) : null}
        </div>
        <QuizTimer
          startedAtIso={startedAtRef.current}
          durationSeconds={quiz.durationSeconds ?? null}
          onExpire={handleExpire}
        />
      </header>

      <QuizSession
        question={currentQuestion}
        currentIndex={index}
        total={total}
        selectedOptionId={currentSelection}
        onSelect={handleSelect}
        onPrev={handlePrev}
        onNext={handleNext}
        onSubmit={handleSubmit}
        isBusy={isBusy}
      />
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-[rgb(var(--danger))] bg-[rgb(var(--surface))] p-4 text-sm text-[rgb(var(--danger))]"
    >
      {message}
      <div className="mt-3">
        <Link href="/quiz" className="text-[rgb(var(--accent))] hover:underline">
          ← Kembali ke daftar quiz
        </Link>
      </div>
    </div>
  )
}

