// Cached display of the current user's AI credit balance.
//
// This store is intentionally *just state*: the Navbar (or wherever the
// chip is rendered) is responsible for refetching via React-Query and
// calling `set()` to push fresh numbers in. We keep the cache outside of
// React-Query so that components without query access (e.g. server-streamed
// chat dialogs) can still read the last-known value synchronously.
//
// Not persisted — credits change frequently and a stale value across page
// reloads would be misleading.

import { create } from 'zustand'

export interface AiCreditState {
  /** Remaining credits for the current billing period. `null` = unknown. */
  creditsRemaining: number | null
  /** ISO timestamp at which the quota resets. `null` = unknown. */
  resetAt: string | null
  /** When the value was last refreshed (ms epoch). Useful for staleness UIs. */
  lastFetchedAt: number | null

  set: (input: { creditsRemaining: number; resetAt: string | null }) => void
  /** Optimistic deduction — for streaming chat that wants instant feedback. */
  consume: (credits: number) => void
  reset: () => void
}

export const useAiCreditStore = create<AiCreditState>((set) => ({
  creditsRemaining: null,
  resetAt: null,
  lastFetchedAt: null,

  set: ({ creditsRemaining, resetAt }) =>
    set({
      creditsRemaining,
      resetAt,
      lastFetchedAt: Date.now(),
    }),

  consume: (credits) =>
    set((s) => ({
      creditsRemaining:
        s.creditsRemaining === null ? null : Math.max(0, s.creditsRemaining - credits),
    })),

  reset: () =>
    set({
      creditsRemaining: null,
      resetAt: null,
      lastFetchedAt: null,
    }),
}))
