// Result detail layout for a completed quiz attempt (WIREFRAMES §14).
//
// Displays score, pass/fail status, optional per-question review, and CTAs to
// retry the same quiz or pick a different one. The "high score" celebration
// is a pure-CSS confetti animation defined inline (no heavy lib).
//
// Per-question review is rendered when the parent supplies `questions` — the
// public quiz endpoint hides `is_correct`, so the parent typically passes
// just the user's selections and we render them without correctness marks.
// Once a server-side attempt detail endpoint exists, the parent can fill in
// `isCorrect` and `correctOptionId` to show full review.

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface QuizResultOptionView {
  id: string
  textId: string
  textAr?: string | null
  /** Optional — only set when the API exposes the answer key in review. */
  isCorrect?: boolean
}

export interface QuizResultQuestionView {
  id: string
  questionId: string
  questionAr?: string | null
  options: QuizResultOptionView[]
  /** The option the user selected during the attempt (if any). */
  selectedOptionId: string | null
  /** Whether the user's selection was correct (server-computed). */
  isCorrect?: boolean
}

export interface QuizResultProps {
  quizTitleId: string
  quizSlug: string
  score: number
  totalQuestions: number
  correctCount?: number
  /** When true, renders a simple confetti animation overlay. */
  celebrate?: boolean
  /** Optional per-question review. Omit to render the score block only. */
  questions?: QuizResultQuestionView[]
}

const PASS_THRESHOLD = 0.7 // 70% — wireframes don't specify; keep generous.

export function QuizResult({
  quizTitleId,
  quizSlug,
  score,
  totalQuestions,
  correctCount,
  celebrate = false,
  questions,
}: QuizResultProps) {
  const denominator = Math.max(1, totalQuestions)
  const correct = correctCount ?? score
  const ratio = correct / denominator
  const passed = ratio >= PASS_THRESHOLD
  const percentage = Math.round(ratio * 100)

  return (
    <div className="relative flex flex-col gap-6">
      {celebrate ? <Confetti /> : null}

      <div
        className={cn(
          'flex flex-col items-center gap-3 rounded-lg border p-6 text-center',
          passed
            ? 'border-[rgb(var(--success))] bg-[rgb(var(--surface))]'
            : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
        )}
      >
        <div className="text-sm text-[rgb(var(--text-muted))]">
          {quizTitleId}
        </div>
        <div className="text-5xl font-bold leading-none text-[rgb(var(--text))]">
          {correct}
          <span className="text-2xl text-[rgb(var(--text-muted))]">
            /{totalQuestions}
          </span>
        </div>
        <div className="text-sm text-[rgb(var(--text-muted))]">
          {percentage}% benar
          {typeof score === 'number' && score !== correct ? (
            <span className="ml-2 text-xs text-[rgb(var(--text-faint))]">
              · {score} poin
            </span>
          ) : null}
        </div>
        <Badge
          variant={passed ? 'success' : 'warning'}
          className="px-3 py-1 text-sm"
        >
          {passed ? 'Lulus ✓' : 'Belum lulus'}
        </Badge>
      </div>

      {questions && questions.length > 0 ? (
        <section
          aria-label="Review jawaban"
          className="flex flex-col gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
        >
          <h2 className="text-base font-semibold text-[rgb(var(--text))]">
            Review Jawaban
          </h2>
          <ul className="flex flex-col gap-3">
            {questions.map((q, idx) => (
              <ReviewRow key={q.id} index={idx} question={q} />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href="/quiz">Pilih Quiz Lain</Link>
        </Button>
        <Button asChild variant="primary">
          <Link href={`/quiz/${quizSlug}`}>Coba Lagi</Link>
        </Button>
      </div>
    </div>
  )
}

function ReviewRow({
  index,
  question,
}: {
  index: number
  question: QuizResultQuestionView
}) {
  const selected = question.options.find((o) => o.id === question.selectedOptionId)
  const correct = question.options.find((o) => o.isCorrect)
  const knownCorrectness = typeof question.isCorrect === 'boolean'

  return (
    <li className="flex flex-col gap-1.5 border-b border-[rgb(var(--border))] pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-[rgb(var(--text-faint))]">
          Soal {index + 1}
        </span>
        {knownCorrectness ? (
          <Badge
            variant={question.isCorrect ? 'success' : 'destructive'}
            className="px-2 py-0 text-[10px]"
          >
            {question.isCorrect ? 'Benar' : 'Salah'}
          </Badge>
        ) : null}
      </div>
      {question.questionAr ? (
        <p
          lang="ar"
          dir="rtl"
          className="text-base leading-relaxed text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-body-arab)' }}
        >
          {question.questionAr}
        </p>
      ) : null}
      <p className="text-sm leading-relaxed text-[rgb(var(--text))]">
        {question.questionId}
      </p>
      <div className="mt-1 text-xs text-[rgb(var(--text-muted))]">
        <span className="text-[rgb(var(--text-faint))]">Jawaban Anda: </span>
        {selected ? selected.textId : (
          <em className="text-[rgb(var(--text-faint))]">tidak dijawab</em>
        )}
      </div>
      {correct && correct.id !== question.selectedOptionId ? (
        <div className="text-xs text-[rgb(var(--success))]">
          Jawaban benar: {correct.textId}
        </div>
      ) : null}
    </li>
  )
}

/**
 * Pure-CSS confetti — 30 absolutely-positioned spans that fall + spin via
 * keyframes defined inline in the document head. Lightweight; no JS RAF.
 */
function Confetti() {
  const pieces = Array.from({ length: 30 })
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -top-4 overflow-hidden"
    >
      <style>{CONFETTI_KEYFRAMES}</style>
      {pieces.map((_, i) => {
        const left = (i * 97) % 100
        const delay = (i % 10) * 0.15
        const duration = 2.4 + ((i * 13) % 18) / 10
        const hue = (i * 47) % 360
        return (
          <span
            key={i}
            style={{
              left: `${left}%`,
              backgroundColor: `hsl(${hue} 80% 60%)`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
            className="athar-confetti-piece"
          />
        )
      })}
    </div>
  )
}

const CONFETTI_KEYFRAMES = `
  @keyframes athar-confetti-fall {
    0% { transform: translateY(-20px) rotate(0deg); opacity: 0; }
    10% { opacity: 1; }
    100% { transform: translateY(420px) rotate(720deg); opacity: 0; }
  }
  .athar-confetti-piece {
    position: absolute;
    top: -10px;
    width: 8px;
    height: 14px;
    border-radius: 2px;
    animation-name: athar-confetti-fall;
    animation-timing-function: cubic-bezier(0.2, 0.6, 0.4, 1);
    animation-iteration-count: 1;
    animation-fill-mode: forwards;
  }
`
