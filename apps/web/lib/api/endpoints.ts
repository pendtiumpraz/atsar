// Typed endpoint helpers for the Atsar HTTP API.
//
// Keep this file thin: each helper just translates a call site (resource +
// params) into an `api()` call. Response types are intentionally loose
// (`any` / shallow shapes) so adding new fields in the backend doesn't break
// compilation of unrelated screens. Tighten individual responses inline as
// callers start depending on specific fields.
//
// Convention:
//   - List endpoints return `{ rows, total, page, perPage }` (mirrors the
//     `paginatedOk` envelope: `data` is the array and pagination lives in
//     `meta`. The `api()` wrapper returns `data` — so we expose a helper
//     `list*` that returns rows only, plus a `*Page` variant when callers
//     need pagination meta, via the `withMeta` escape hatch below.)
//   - Mutating endpoints return the created/updated resource.

import { api, apiPaginated, type ApiRequestInit } from './client'

// ─── Shared types (kept loose on purpose) ──────────────────────────────
export type Paginated<T> = { rows: T[]; total: number; page: number; perPage: number }
export type Page<T> = T[] // alias for endpoints where backend already returns rows

function buildQuery(params?: object): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue
        search.append(key, String(item))
      }
    } else {
      search.append(key, String(value))
    }
  }
  const qs = search.toString()
  return qs.length > 0 ? `?${qs}` : ''
}

// ─── Figures ───────────────────────────────────────────────────────────
export interface FigureListParams {
  q?: string
  category?: string
  gender?: 'male' | 'female'
  page?: number
  perPage?: number
}

export const figuresApi = {
  list: (params: FigureListParams = {}) =>
    apiPaginated<any>(`/figures${buildQuery(params)}`),
  getBySlug: (slug: string) => api.get<any>(`/figures/${encodeURIComponent(slug)}`),
  create: (body: Record<string, unknown>, init?: ApiRequestInit) =>
    api.post<any>('/figures', body, init),
  update: (slug: string, body: Record<string, unknown>) =>
    api.patch<any>(`/figures/${encodeURIComponent(slug)}`, body),
  remove: (slug: string) => api.delete<{ id: string }>(`/figures/${encodeURIComponent(slug)}`),
  trash: {
    list: (params: { page?: number; perPage?: number } = {}) =>
      apiPaginated<any>(`/trash/figures${buildQuery(params)}`),
    restore: (id: string) => api.post<{ id: string }>(`/trash/figures/${id}/restore`),
    hardDelete: (id: string) => api.delete<{ id: string }>(`/trash/figures/${id}/hard`),
  },
}

// ─── Battles ───────────────────────────────────────────────────────────
export interface BattleListParams {
  q?: string
  page?: number
  perPage?: number
}

export const battlesApi = {
  list: (params: BattleListParams = {}) =>
    apiPaginated<any>(`/battles${buildQuery(params)}`),
  getBySlug: (slug: string) => api.get<any>(`/battles/${encodeURIComponent(slug)}`),
  create: (body: Record<string, unknown>) => api.post<any>('/battles', body),
  update: (slug: string, body: Record<string, unknown>) =>
    api.patch<any>(`/battles/${encodeURIComponent(slug)}`, body),
  remove: (slug: string) => api.delete<{ id: string }>(`/battles/${encodeURIComponent(slug)}`),
  phases: {
    list: (slug: string) => api.get<any[]>(`/battles/${encodeURIComponent(slug)}/phases`),
    create: (slug: string, body: Record<string, unknown>) =>
      api.post<any>(`/battles/${encodeURIComponent(slug)}/phases`, body),
  },
  participants: {
    list: (slug: string) =>
      api.get<any[]>(`/battles/${encodeURIComponent(slug)}/participants`),
    add: (slug: string, body: Record<string, unknown>) =>
      api.post<any>(`/battles/${encodeURIComponent(slug)}/participants`, body),
  },
  trash: {
    list: (params: { page?: number; perPage?: number } = {}) =>
      apiPaginated<any>(`/trash/battles${buildQuery(params)}`),
    restore: (id: string) => api.post<{ id: string }>(`/trash/battles/${id}/restore`),
    hardDelete: (id: string) => api.delete<{ id: string }>(`/trash/battles/${id}/hard`),
  },
}

// ─── Quizzes ───────────────────────────────────────────────────────────
export interface QuizListParams {
  q?: string
  page?: number
  perPage?: number
}

export const quizzesApi = {
  list: (params: QuizListParams = {}) =>
    apiPaginated<any>(`/quizzes${buildQuery(params)}`),
  getBySlug: (slug: string) => api.get<any>(`/quizzes/${encodeURIComponent(slug)}`),
  start: (slug: string) =>
    api.post<{ attemptId: string }>(`/quizzes/${encodeURIComponent(slug)}/start`, {}),
  answer: (attemptId: string, body: { questionId: string; answer: unknown }) =>
    api.post<any>(`/quizzes/attempts/${attemptId}/answer`, body),
  complete: (attemptId: string) =>
    api.post<any>(`/quizzes/attempts/${attemptId}/complete`, {}),
  admin: {
    list: (params: QuizListParams = {}) =>
      apiPaginated<any>(`/admin/quizzes${buildQuery(params)}`),
    create: (body: Record<string, unknown>) => api.post<any>('/admin/quizzes', body),
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/quizzes/${id}`, body),
    remove: (id: string) => api.delete<{ id: string }>(`/admin/quizzes/${id}`),
    questions: {
      list: (id: string) => api.get<any[]>(`/admin/quizzes/${id}/questions`),
      create: (id: string, body: Record<string, unknown>) =>
        api.post<any>(`/admin/quizzes/${id}/questions`, body),
    },
  },
}

// ─── AI (chat + usage) ─────────────────────────────────────────────────
export interface AiUsageParams {
  role?: 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'
  from?: string
  to?: string
  page?: number
  perPage?: number
}

export const aiApi = {
  /**
   * Chat streams binary data (Vercel AI SDK data-stream format) — wrapping it
   * in `api()` would consume the response. Instead expose a raw `fetch`
   * helper that returns the `Response` for the streaming client to consume.
   */
  chatStream: (
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    init?: RequestInit,
  ) =>
    fetch('/api/v1/ai/chat', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      body: JSON.stringify({ messages }),
      ...init,
    }),
  usage: (params: AiUsageParams = {}) =>
    apiPaginated<any>(`/ai/usage${buildQuery(params)}`),
}

// ─── PDF jobs ──────────────────────────────────────────────────────────
export interface PdfJobCreateInput {
  figureIds: string[]
  templateSlug: string
  paperSize?: 'a4' | 'a5' | 'letter' | 'legal'
  orientation?: 'portrait' | 'landscape'
  languageMode?: 'id' | 'ar' | 'both'
  titleAr?: string
  titleId?: string
  authorName?: string
  authorEmail?: string
  includeIllustrations?: boolean
  includeMaps?: boolean
  includeTimeline?: boolean
}

export const pdfApi = {
  enqueue: (body: PdfJobCreateInput, idempotencyKey?: string) =>
    api.post<{ id: string; status: string }>('/pdf/jobs', body, { idempotencyKey }),
  list: (
    params: {
      page?: number
      perPage?: number
      status?: 'queued' | 'processing' | 'done' | 'failed'
    } = {},
  ) => apiPaginated<any>(`/pdf/jobs${buildQuery(params)}`),
  get: (id: string) => api.get<any>(`/pdf/jobs/${id}`),
}

// ─── Notifications ─────────────────────────────────────────────────────
export const notificationsApi = {
  list: (params: { page?: number; perPage?: number; unreadOnly?: boolean } = {}) =>
    apiPaginated<any>(`/notifications${buildQuery(params)}`),
  markRead: (id: string) => api.post<{ id: string }>(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post<{ count: number }>('/notifications/read-all', {}),
}

// ─── Citations ─────────────────────────────────────────────────────────
export const citationsApi = {
  list: (params: { page?: number; perPage?: number; figureId?: string } = {}) =>
    apiPaginated<any>(`/citations${buildQuery(params)}`),
  admin: {
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/citations/${id}`, body),
    remove: (id: string) => api.delete<{ id: string }>(`/admin/citations/${id}`),
  },
}

// ─── Locations ─────────────────────────────────────────────────────────
export const locationsApi = {
  list: (params: { q?: string; page?: number; perPage?: number } = {}) =>
    apiPaginated<any>(`/locations${buildQuery(params)}`),
  admin: {
    list: (params: { q?: string; page?: number; perPage?: number } = {}) =>
      apiPaginated<any>(`/admin/locations${buildQuery(params)}`),
    create: (body: Record<string, unknown>) => api.post<any>('/admin/locations', body),
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/locations/${id}`, body),
    remove: (id: string) => api.delete<{ id: string }>(`/admin/locations/${id}`),
  },
}

// ─── Subscriptions ─────────────────────────────────────────────────────
export const subscriptionsApi = {
  me: () => api.get<any>('/subscriptions/me'),
  admin: {
    list: (
      params: {
        page?: number
        perPage?: number
        tier?: string
        userId?: string
        status?: string
      } = {},
    ) => apiPaginated<any>(`/admin/subscriptions${buildQuery(params)}`),
    activate: (id: string, body: Record<string, unknown> = {}) =>
      api.post<any>(`/admin/subscriptions/${id}/activate`, body),
  },
}

// ─── Payments (admin) ──────────────────────────────────────────────────
export const paymentsApi = {
  admin: {
    list: (
      params: {
        page?: number
        perPage?: number
        status?: string
        userId?: string
      } = {},
    ) => apiPaginated<any>(`/admin/payments${buildQuery(params)}`),
    confirm: (id: string) => api.post<any>(`/admin/payments/${id}/confirm`, {}),
    reject: (id: string, reason?: string) =>
      api.post<any>(`/admin/payments/${id}/reject`, { reason }),
  },
}

// ─── Reviewer queue / assignments ──────────────────────────────────────
export const reviewerApi = {
  queue: (params: { page?: number; perPage?: number; status?: string } = {}) =>
    apiPaginated<any>(`/reviewer/queue${buildQuery(params)}`),
  get: (id: string) => api.get<any>(`/reviewer/assignments/${id}`),
  approve: (id: string, body: Record<string, unknown> = {}) =>
    api.post<any>(`/reviewer/assignments/${id}/approve`, body),
  reject: (id: string, body: Record<string, unknown> = {}) =>
    api.post<any>(`/reviewer/assignments/${id}/reject`, body),
  requestEdit: (id: string, body: Record<string, unknown> = {}) =>
    api.post<any>(`/reviewer/assignments/${id}/request-edit`, body),
}

// ─── Admin: users / roles / permissions / menus / audit ────────────────
export const adminApi = {
  users: {
    list: (params: { q?: string; page?: number; perPage?: number; role?: string } = {}) =>
      apiPaginated<any>(`/admin/users${buildQuery(params)}`),
    get: (id: string) => api.get<any>(`/admin/users/${id}`),
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/users/${id}`, body),
    setRoles: (id: string, roleIds: string[]) =>
      api.put<any>(`/admin/users/${id}/roles`, { roleIds }),
  },
  roles: {
    list: () => api.get<any[]>('/admin/roles'),
    get: (id: string) => api.get<any>(`/admin/roles/${id}`),
    create: (body: Record<string, unknown>) => api.post<any>('/admin/roles', body),
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/roles/${id}`, body),
    remove: (id: string) => api.delete<{ id: string }>(`/admin/roles/${id}`),
    setPermissions: (id: string, permissionIds: string[]) =>
      api.put<any>(`/admin/roles/${id}/permissions`, { permissionIds }),
  },
  permissions: {
    list: () => api.get<any[]>('/admin/permissions'),
  },
  menus: {
    list: () => api.get<any[]>('/admin/menus'),
    setAccess: (body: Record<string, unknown>) => api.put<any>('/admin/menus/access', body),
  },
  auditLogs: {
    list: (
      params: {
        page?: number
        perPage?: number
        actorId?: string
        action?: string
        resourceType?: string
        resourceId?: string
        from?: string
        to?: string
      } = {},
    ) => apiPaginated<any>(`/admin/audit-logs${buildQuery(params)}`),
    get: (id: string) => api.get<any>(`/admin/audit-logs/${id}`),
  },
  fonts: {
    list: () => api.get<any[]>('/admin/fonts'),
    create: (body: Record<string, unknown> | FormData) => api.post<any>('/admin/fonts', body),
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/fonts/${id}`, body),
    remove: (id: string) => api.delete<{ id: string }>(`/admin/fonts/${id}`),
    activate: (id: string) => api.post<any>(`/admin/fonts/${id}/activate`, {}),
    assignments: {
      list: () => api.get<any[]>('/admin/fonts/assignments'),
      set: (body: Record<string, unknown>) => api.put<any>('/admin/fonts/assignments', body),
    },
  },
  research: {
    run: (body: Record<string, unknown>) => api.post<any>('/admin/research', body),
  },
  docAnalyze: {
    run: (body: Record<string, unknown> | FormData) => api.post<any>('/admin/doc-analyze', body),
  },
  whitelist: {
    list: (params: { page?: number; perPage?: number; q?: string } = {}) =>
      apiPaginated<any>(`/admin/whitelist${buildQuery(params)}`),
    create: (body: Record<string, unknown>) => api.post<any>('/admin/whitelist', body),
    update: (id: string, body: Record<string, unknown>) =>
      api.patch<any>(`/admin/whitelist/${id}`, body),
    remove: (id: string) => api.delete<{ id: string }>(`/admin/whitelist/${id}`),
  },
}

// ─── Public / misc ─────────────────────────────────────────────────────
export const publicApi = {
  themeFonts: () => api.get<any[]>('/public/theme/fonts'),
}

export const uploadsApi = {
  upload: (file: File | FormData, idempotencyKey?: string) => {
    const body = file instanceof FormData ? file : (() => {
      const fd = new FormData()
      fd.append('file', file)
      return fd
    })()
    return api.post<{ url: string; key: string }>('/uploads', body, { idempotencyKey })
  },
}
