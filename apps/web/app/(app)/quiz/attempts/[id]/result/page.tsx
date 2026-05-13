// `/quiz/attempts/[id]/result` — post-attempt summary (WIREFRAMES §14).
//
// Server component. Score + total + correct count are forwarded as query
// params by the attempt page (after a successful `/complete` call) — there
// is no dedicated attempt-detail HTTP endpoint yet, so we trust the URL for
// the headline numbers and fetch the quiz separately for review titles.
//
// When `?slug=` is present, we load the quiz so we can:
//   - Render the quiz title in the result card.
//   - Optionally surface a per-question review (questions, not answers — the
//     public endpoint hides `is_correct`).  When the API exposes attempt
//     answers in the future, plug them in here.
//
// Confetti shows only for scores ≥ 70%.

import type { Metadata } from 'next'

import { QuizResult, type QuizResultQuestionView } from '@/components/quiz/quiz-result'
import { ApiError } from '@/lib/server/api'
import { quizService } from '@/lib/server/services/quiz.service'

interface ResultPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const metadata: Metadata = {
  title: 'Hasil Quiz',
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function toInt(value: string | undefined, fallback = 0): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

async function loadQuiz(slug: string) {
  try {
    return await quizService.getBySlugForUser(slug, '')
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NOT_FOUND') return null
    throw err
  }
}

const CELEBRATE_THRESHOLD = 0.7

export default async function QuizResultPage({
  params: _params,
  searchParams,
}: ResultPageProps) {
  // We intentionally ignore the attempt id for now — there's no GET
  // endpoint that returns its full detail. Once one exists, fetch it here
  // and use it as the source of truth instead of query params.
  await _params

  const sp = await searchParams
  const slug = pick(sp.slug) ?? ''
  const score = toInt(pick(sp.score))
  const total = Math.max(1, toInt(pick(sp.total), 1))
  const correctRaw = pick(sp.correct)
  const correctCount = correctRaw !== undefined ? toInt(correctRaw, score) : score

  const quiz = slug ? await loadQuiz(slug) : null
  const quizTitleId = quiz?.titleId ?? 'Quiz'

  // Per-question review without correctness flags (the public endpoint hides
  // `is_correct`). When we don't know the user's selections from URL state,
  // we still render the question + options as a study aid so the user can
  // re-read what they just took. selectedOptionId is left null.
  // TODO: replace with a real attempt-detail fetch once the API exposes it.
  let reviewQuestions: QuizResultQuestionView[] | undefined
  if (quiz?.questions && quiz.questions.length > 0) {
    reviewQuestions = quiz.questions.map((q) => ({
      id: q.id,
      questionId: q.questionId,
      questionAr: q.questionAr,
      selectedOptionId: null,
      options: q.options.map((o) => ({
        id: o.id,
        textId: o.textId,
        textAr: o.textAr,
        // isCorrect intentionally omitted — service strips it for users.
      })),
    }))
  }

  const ratio = correctCount / total
  const celebrate = ratio >= CELEBRATE_THRESHOLD

  return (
    <div className="mx-auto max-w-2xl">
      <QuizResult
        quizTitleId={quizTitleId}
        quizSlug={slug || ''}
        score={score}
        totalQuestions={total}
        correctCount={correctCount}
        celebrate={celebrate}
        questions={reviewQuestions}
      />
    </div>
  )
}
