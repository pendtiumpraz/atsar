// Side-by-side text diff using `react-diff-viewer-continued`.
//
// Used in two places (so far):
//   - Comparing the current draft against the previous revision.
//   - Showing the AI-generated rewrite that came back from `/request-edit`.
//
// We wrap the upstream component so we can:
//   - Provide Atsar-themed colours via CSS variables (light/dark).
//   - Default to split view with word-level inline highlighting.
//   - Fall back gracefully when one side is empty (treats it as a brand-new
//     insertion rather than rendering a confusing blank gutter).

'use client'

import { useMemo } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

import { cn } from '@/lib/utils'

export interface DiffViewerProps {
  /** Original / left-hand side. */
  oldValue: string | null | undefined
  /** Revised / right-hand side. */
  newValue: string | null | undefined
  /** Caption shown above the diff (e.g. "Revisi v1 → v2"). */
  title?: string
  /** Defaults to true (side-by-side). Pass `false` for unified mode. */
  splitView?: boolean
  /** Labels for the two columns. */
  leftTitle?: string
  rightTitle?: string
  className?: string
}

export function DiffViewer({
  oldValue,
  newValue,
  title,
  splitView = true,
  leftTitle = 'Sebelum',
  rightTitle = 'Sesudah',
  className,
}: DiffViewerProps) {
  // `react-diff-viewer-continued` chokes on `null` / `undefined` — coerce to
  // empty string. An empty-vs-empty diff renders as a single placeholder row,
  // which is fine for the initial-draft case.
  const safeOld = oldValue ?? ''
  const safeNew = newValue ?? ''

  // Theme tokens — pulled from `app/globals.css`. We keep the palette minimal
  // and let the global theme drive light/dark mode.
  const styles = useMemo(
    () => ({
      variables: {
        light: {
          diffViewerBackground: 'rgb(var(--surface))',
          diffViewerColor: 'rgb(var(--text))',
          addedBackground: 'rgba(16, 185, 129, 0.12)',
          addedColor: 'rgb(var(--text))',
          removedBackground: 'rgba(244, 63, 94, 0.12)',
          removedColor: 'rgb(var(--text))',
          wordAddedBackground: 'rgba(16, 185, 129, 0.32)',
          wordRemovedBackground: 'rgba(244, 63, 94, 0.32)',
          addedGutterBackground: 'rgba(16, 185, 129, 0.18)',
          removedGutterBackground: 'rgba(244, 63, 94, 0.18)',
          gutterBackground: 'rgb(var(--bg-elevated))',
          gutterBackgroundDark: 'rgb(var(--bg-elevated))',
          highlightBackground: 'rgba(245, 158, 11, 0.18)',
          highlightGutterBackground: 'rgba(245, 158, 11, 0.24)',
          codeFoldGutterBackground: 'rgb(var(--bg-elevated))',
          codeFoldBackground: 'rgb(var(--bg-elevated))',
          emptyLineBackground: 'rgb(var(--surface))',
          gutterColor: 'rgb(var(--text-faint))',
          addedGutterColor: 'rgb(var(--text))',
          removedGutterColor: 'rgb(var(--text))',
          codeFoldContentColor: 'rgb(var(--text-muted))',
          diffViewerTitleBackground: 'rgb(var(--bg-elevated))',
          diffViewerTitleColor: 'rgb(var(--text))',
          diffViewerTitleBorderColor: 'rgb(var(--border))',
        },
      },
      contentText: {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.85rem',
        lineHeight: '1.5',
      },
    }),
    [],
  )

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]',
        className,
      )}
    >
      {title ? (
        <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm font-medium text-[rgb(var(--text))]">
          {title}
        </div>
      ) : null}
      <ReactDiffViewer
        oldValue={safeOld}
        newValue={safeNew}
        splitView={splitView}
        compareMethod={DiffMethod.WORDS}
        leftTitle={leftTitle}
        rightTitle={rightTitle}
        useDarkTheme={false}
        styles={styles}
      />
    </div>
  )
}
