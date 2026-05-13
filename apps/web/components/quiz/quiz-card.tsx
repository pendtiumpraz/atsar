// Compact quiz card used in the `/quiz` list (WIREFRAMES §14).
//
// Layout:
//   ┌──────────────────────────────────────────────┐
//   │ Quiz Para Sahabat                             │
//   │ أسئلة عن الصحابة                                │
//   │ [Sahabat] [Mudah] · 10 soal · 5 menit         │
//   │                                  [Mulai →]    │
//   └──────────────────────────────────────────────┘
//
// Renders as a `<Link>` so the entire card is clickable. The visible "Mulai"
// pill is purely decorative (it inherits the same click target).

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Loose shape — `quizzesApi.list` returns `any` today. Only the fields used
// here are typed; everything else stays optional.
export interface QuizCardData {
  id: string
  slug: string
  titleId: string
  titleAr?: string | null
  descriptionId?: string | null
  category?: string | null
  difficulty?: 'easy' | 'medium' | 'hard' | null
  durationSeconds?: number | null
  totalQuestions?: number | null
}

export interface QuizCardProps {
  quiz: QuizCardData
  className?: string
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Mudah',
  medium: 'Sedang',
  hard: 'Sulit',
}

const DIFFICULTY_VARIANT: Record<
  string,
  'success' | 'warning' | 'destructive'
> = {
  easy: 'success',
  medium: 'warning',
  hard: 'destructive',
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null
  const mins = Math.round(seconds / 60)
  if (mins < 1) return `${seconds} dtk`
  return `${mins} mnt`
}

export function QuizCard({ quiz, className }: QuizCardProps) {
  const difficultyLabel = quiz.difficulty
    ? (DIFFICULTY_LABEL[quiz.difficulty] ?? quiz.difficulty)
    : null
  const difficultyVariant = quiz.difficulty
    ? DIFFICULTY_VARIANT[quiz.difficulty]
    : undefined
  const duration = formatDuration(quiz.durationSeconds)

  return (
    <Link
      href={`/quiz/${quiz.slug}`}
      className={cn(
        'group block rounded-lg border bg-[rgb(var(--surface))] p-4 transition-colors',
        'border-[rgb(var(--border))]',
        'hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-[rgb(var(--text))]">
            {quiz.titleId}
          </div>
          {quiz.titleAr ? (
            <div
              lang="ar"
              dir="rtl"
              className="truncate text-base text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {quiz.titleAr}
            </div>
          ) : null}
          {quiz.descriptionId ? (
            <p className="mt-1 line-clamp-2 text-sm text-[rgb(var(--text-muted))]">
              {quiz.descriptionId}
            </p>
          ) : null}
        </div>

        <span
          aria-hidden
          className={cn(
            'shrink-0 rounded-md px-3 py-1.5 text-xs font-medium',
            'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]',
            'opacity-90 group-hover:opacity-100',
          )}
        >
          Mulai →
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--text-muted))]">
        {quiz.category ? (
          <Badge variant="secondary" className="px-2 py-0">
            {quiz.category}
          </Badge>
        ) : null}
        {difficultyLabel ? (
          <Badge variant={difficultyVariant ?? 'outline'} className="px-2 py-0">
            {difficultyLabel}
          </Badge>
        ) : null}
        {typeof quiz.totalQuestions === 'number' && quiz.totalQuestions > 0 ? (
          <span className="text-[rgb(var(--text-faint))]">
            {quiz.totalQuestions} soal
          </span>
        ) : null}
        {duration ? (
          <span className="text-[rgb(var(--text-faint))]">· {duration}</span>
        ) : null}
      </div>
    </Link>
  )
}
