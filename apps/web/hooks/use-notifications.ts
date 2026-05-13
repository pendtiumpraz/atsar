'use client'

/**
 * useNotifications — TanStack Query + SSE bridge for `/notifications`.
 *
 * Responsibilities:
 *   - `useQuery` for `GET /api/v1/notifications?...` with a 30s refetch
 *     interval (acts as a polling fallback if SSE is blocked).
 *   - `EventSource` subscription to `/api/v1/notifications/stream` — on every
 *     `notification` event we invalidate the list so React Query re-fetches.
 *     The connection is torn down on unmount.
 *   - Mutations `markRead(id)` and `markAllRead()` hit POST endpoints and
 *     invalidate the cached list (and the navbar bell's `['notifications',
 *     'unread']` key for good measure).
 *
 * The list response is the standard envelope `{ ok, data, meta }`, where
 * `meta.total` counts items matching the query (so when `unreadOnly` is true
 * it doubles as `unreadCount`). When `unreadOnly` is false we compute the
 * unread count client-side from the array.
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api/client'

/** Notification row shape returned by the API.  Matches `packages/db/src/schema/notifications.ts`. */
export interface NotificationRow {
  id: string
  userId: string
  type: string
  title: string | null
  body: string | null
  actionUrl: string | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

interface ApiEnvelope<T> {
  ok: boolean
  data: T
  meta?: { page?: number; perPage?: number; total?: number; totalPages?: number }
  error?: { code: string; message: string }
}

interface ListResult {
  items: NotificationRow[]
  total: number
}

interface UseNotificationsOptions {
  unreadOnly?: boolean
  perPage?: number
}

/** Raw fetch (bypasses `api.get`) so we can read `meta.total` from the envelope. */
async function fetchNotifications(
  unreadOnly: boolean,
  perPage: number,
): Promise<ListResult> {
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('perPage', String(perPage))
  if (unreadOnly) params.set('unreadOnly', 'true')

  const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  const env = (await res.json().catch(() => null)) as ApiEnvelope<NotificationRow[]> | null
  if (!res.ok || !env || !env.ok) {
    throw new Error(env?.error?.message ?? `Gagal memuat notifikasi (${res.status})`)
  }

  const items = env.data ?? []
  const total = env.meta?.total ?? items.length
  return { items, total }
}

export function useNotifications(
  { unreadOnly = false, perPage = 50 }: UseNotificationsOptions = {},
) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(
    () => ['notifications', { unreadOnly, perPage }] as const,
    [unreadOnly, perPage],
  )

  const query = useQuery<ListResult>({
    queryKey,
    queryFn: () => fetchNotifications(unreadOnly, perPage),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 10_000,
  })

  // SSE realtime: invalidate on every server-pushed `notification` event.
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return

    let es: EventSource | null = null
    try {
      es = new EventSource('/api/v1/notifications/stream', { withCredentials: true })
    } catch {
      return
    }

    const onNotification = () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    es.addEventListener('notification', onNotification)
    // We rely on EventSource's built-in auto-reconnect for transient errors.

    return () => {
      es?.removeEventListener('notification', onNotification)
      es?.close()
    }
  }, [queryClient])

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`)
      return id
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post('/notifications/read-all')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const items = query.data?.items ?? []
  const unreadCount = unreadOnly
    ? (query.data?.total ?? items.length)
    : items.reduce((n, item) => (item.isRead ? n : n + 1), 0)

  return {
    notifications: items,
    unreadCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    markRead: markReadMutation.mutate,
    markReadAsync: markReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending,
    markAllRead: markAllReadMutation.mutate,
    markAllReadAsync: markAllReadMutation.mutateAsync,
    isMarkingAllRead: markAllReadMutation.isPending,
    refetch: query.refetch,
  }
}

export default useNotifications
