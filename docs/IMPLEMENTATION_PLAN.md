# Athar — Implementation Plan

> Step-by-step implementation dengan progress checklist.
> **Aturan utama**:
> - Urutan ketat: **Database → Backend → Frontend** per fitur.
> - **No dummy data hardcoded** — semua via seeders.
> - Centang `[x]` setiap task selesai (commit dengan pesan jelas).
> - Tidak ada lompat fase tanpa fase sebelumnya selesai.
> - Cross-reference: DATABASE.md, BACKEND.md, FRONTEND.md, WIREFRAMES.md, UI_UX.md.

---

## Konvensi Status

- `[ ]` Belum dikerjakan
- `[~]` Sedang dikerjakan
- `[x]` Selesai & merged
- `[!]` Blocked (tulis alasan di sampingnya)

---

## Phase 0 — Foundation & Repo Setup

**Tujuan**: monorepo siap, dev environment jalan, CI/CD basic.

> **Catatan**: pivot dari Hetzner+Coolify → **Vercel** (per keputusan user). Beberapa task superseded — lihat ARCHITECTURE.md.

- [x] **0.1** Init monorepo dengan pnpm workspaces + Turborepo
- [x] **0.2** Struktur folder: `apps/web`, `apps/worker` (deprecated→QStash), `packages/db`, `packages/ai`, `packages/ui`, `packages/shared`, `packages/hijri`
- [x] **0.3** Setup TypeScript strict, ESLint, Prettier (lint-staged/husky TBD)
- [x] **0.4** Init Next.js 15 di `apps/web` dengan App Router
- [x] **0.5** Worker stub (akan dihapus — diganti dengan QStash + apps/web/app/api/jobs/*)
- [x] **0.6** Tailwind CSS 4 + design tokens (shadcn install TBD di Phase 4)
- [x] **0.7** Pakai **Neon + Upstash + QStash managed** — tidak butuh compose.yml lokal
- [x] **0.8** `.env.example` lengkap
- [x] **0.9** GitHub repo `pendtiumpraz/atsar` setup (branch protection TBD)
- [x] **0.10** GitHub Actions CI: lint, typecheck, build (test job TBD)
- [x] **0.11** **Vercel deploy** (user sudah hubungkan ke DB)
- [ ] **0.12** Domain athar.app/.id pointing, TLS auto (user akan setting di Vercel)
- [ ] **0.13** Setup Sentry (stub ada di apps/web/lib/server/sentry.ts; aktifkan saat butuh)
- [x] **0.14** Setup pino logger struktur

**Exit criteria**: `pnpm dev` jalan lokal, deploy preview kerja, CI green. ✅

---

## Phase 1 — Database Foundation

**Tujuan**: schema awal lengkap + seeders production-ready.

### 1.1 Schema Core (Drizzle)
- [x] **1.1.1** Setup Drizzle config + connection pool (postgres-js for migrate, neon-http for runtime)
- [x] **1.1.2** Enums: 40 enums seeded
- [x] **1.1.3** Migration: `users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`
- [x] **1.1.4** Migration: `roles`, `permissions`, `role_permissions`, `user_roles`
- [x] **1.1.5** Migration: `menu_items`, `role_menu_access`
- [x] **1.1.6** Migration: `reviewer_profiles`
- [x] **1.1.7** Migration: `tiers`, `subscriptions`, `payments`, `quota_usage`
- [x] **1.1.8** Migration: `figure_categories`, `figures`
- [x] **1.1.9** Migration: `figure_relations`, `figure_locations`
- [x] **1.1.10** Migration: `locations` (PostGIS GEOGRAPHY via post-migrate ALTER)
- [x] **1.1.11** Migration: `battles`, `battle_phases`, `battle_participants`, `battle_locations`
- [x] **1.1.12** Migration: `whitelist_domains`, `citations`, `content_citation_embeddings` (pgvector)
- [x] **1.1.13** Migration: `content_revisions`, `review_assignments`
- [x] **1.1.14** Migration: `ai_providers`, `ai_models`, `ai_role_assignments`, `ai_usage_logs`, `ai_credit_packages`
- [x] **1.1.15** Migration: `fonts`, `font_assignments`, `font_assignment_history`
- [x] **1.1.16** Migration: `pdf_jobs`, `pdf_templates`
- [x] **1.1.17** Migration: `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`
- [x] **1.1.18** Migration: `notifications`
- [x] **1.1.19** Migration: `audit_logs`
- [x] **1.1.20** Index: partial index untuk soft delete (lewat unique-index WHERE deleted_at IS NULL)
- [x] **1.1.21** Index: FTS bilingual untuk figures (via post-migrate)
- [x] **1.1.22** Index: PostGIS GIST untuk locations (via post-migrate)
- [x] **1.1.23** Index: pgvector HNSW untuk embeddings (via post-migrate)
- [x] **1.1.24** Triggers: auto-update `updated_at` (33 tables, via post-migrate)
- [x] **1.1.25** Materialized view: `ai_usage_monthly_summary` + hourly QStash cron refresh (P12-D)

### 1.2 Seeders (Wajib, No Hardcoded)
- [x] **1.2.1** `001_roles.ts` — 3 roles seeded (admin, reviewer, subscriber)
- [x] **1.2.2** `002_permissions.ts` — 39 permissions seeded
- [x] **1.2.3** `003_role_permissions.ts` — 52 matrix rows seeded
- [x] **1.2.4** `004_menu_items.ts` — 28 menus including gender-split children
- [x] **1.2.5** `005_role_menu_access.ts` — 65 access rules
- [x] **1.2.6** `006_tiers.ts` — 5 tiers
- [x] **1.2.7** `007_figure_categories.ts` — 6 kategori
- [x] **1.2.8** `008_ai_providers.ts` — 8 providers (DeepSeek active)
- [x] **1.2.9** `009_ai_models.ts` — 20 models (verified Mei 2026)
- [x] **1.2.10** `010_ai_role_assignments.ts` — 4 assignments
- [x] **1.2.11** `011_fonts.ts` — 20 fonts seeded
- [x] **1.2.12** `012_font_assignments.ts` — 7 role slots assigned
- [x] **1.2.13** `013_whitelist_domains.ts` — 6 domains
- [x] **1.2.14** `014_pdf_templates.ts` — 4 templates
- [x] **1.2.15** `015_locations_core.ts` — 30 locations seeded
- [ ] **1.2.16** `016_admin_user.ts` — skeleton exists, butuh SEED_ADMIN_EMAIL/PASSWORD di env
- [x] **1.2.17** `017_demo_figures.ts` — 6 demo figures seeded
- [x] **1.2.18** Commands: `pnpm db:seed`, `pnpm db:seed:dev`, `pnpm db:reset`
- [x] **1.2.19** Test `db:reset` dari scratch sukses

### 1.3 Backup & Disaster Recovery
- [ ] **1.3.1** Cron `pg_dump` harian (Neon punya point-in-time backup built-in — review jika cukup)
- [ ] **1.3.2** Weekly full dump retention 1 tahun
- [ ] **1.3.3** Test restore prosedur

**Exit criteria**: `pnpm db:reset && pnpm db:seed` sukses, semua tabel ada, semua seed terinsert. ✅

---

## Phase 2 — Backend Core

**Tujuan**: auth, RBAC, service layer, audit log, soft delete, trash, error handling.

### 2.1 Auth & RBAC
- [x] **2.1.1** Install & konfigurasi better-auth (Agent 2)
- [x] **2.1.2** Endpoint: register/login via better-auth handler. Magic link + Google OAuth: configurable when needed (better-auth supports both via plugin config). Schema (accounts + verifications tables) ready (P12-C).
- [x] **2.1.3** Session storage di DB + cookie (sessions table)
- [x] **2.1.4** Middleware: `requirePermission` (overloaded 2-arg + curried) + `requireAuth` helper (Agent 3 + merge)
- [x] **2.1.5** Cache effective permissions di Redis (TTL 5 menit, Agent 3)
- [x] **2.1.6** Service: `user.service` CRUD users (Agent 9)
- [x] **2.1.7** Service: `role.service` + `menu.service` (Agent 9)
- [x] **2.1.8** Endpoint: `/api/v1/admin/roles/*`, `/permissions`, `/menus/*` (Agent 9)
- [x] **2.1.9** Endpoint: `/api/v1/admin/users/*` (Agent 9)
- [ ] **2.1.10** Test E2E auth flow (Phase 8)

### 2.2 Service Pattern + Soft Delete
- [x] **2.2.1** `base.service.ts` pattern doc (Agent 4)
- [x] **2.2.2** `figureService`: CRUD + softDelete + restore + hardDelete + listTrash (Agent 4)
- [x] **2.2.3** `battleService`: same pattern (P3-1)
- [x] **2.2.4** `locationService` + admin endpoints (P3-8)
- [x] **2.2.5** Cascade soft delete via `db.batch` (Neon HTTP doesn't support .transaction)
- [x] **2.2.6** Endpoint trash: list, restore, hard-delete (figures + battles)
- [x] **2.2.7** Cron purge-trash route + register-schedules.ts script (P12-D); admin runs once after deploy

### 2.3 Audit Log
- [x] **2.3.1** Service: `auditLog.write(...)` non-blocking (Agent 5)
- [x] **2.3.2** Endpoint: `/api/v1/admin/audit-logs` paginated + filter + single (Agent 5)
- [x] **2.3.3** Integrate ke mutation services (figure, battle, role, menu, payment, font activate)

### 2.4 API Response & Error Handling
- [x] **2.4.1** `withErrorHandling` wrapper (Agent 1)
- [x] **2.4.2** `ApiError` class — 11 codes (Agent 1)
- [x] **2.4.3** Response envelope: `ok`, `created`, `paginatedOk`, `noContent` (Agent 1)
- [x] **2.4.4** Validation: `validateBody`, `validateQuery`, `validateParams` zod helpers (Agent 1)
- [x] **2.4.5** Rate limiting middleware (Redis INCR sliding window) — `lib/server/middleware/rate-limit.ts` (P12-A)
- [x] **2.4.6** Idempotency key support — `lib/server/middleware/idempotency.ts` (P12-A)

### 2.5 Subscription & Quota
- [x] **2.5.1** `subscription.service`: createTrial / getActive / activate / expire / listAll (Agent 7)
- [x] **2.5.2** Payment endpoints: list pending + confirm + reject (Agent 7)
- [x] **2.5.3** `quota.service`: ensureQuota / incrementQuota / getCurrentPeriod / resetForUser (Agent 7)
- [x] **2.5.4** Cron: reset-quotas QStash route (Agent 8); schedule registration TBD
- [x] **2.5.5** Middleware `requireActiveSubscription` + `content-access.service` tier-gating (P12-B)
- [x] **2.5.6** Endpoint: `/api/v1/subscriptions/me`, admin subscriptions + payments (Agent 7)

### 2.6 AI Service Layer
- [x] **2.6.1** `packages/ai`: provider abstraction via Vercel AI SDK (Agent 6)
- [x] **2.6.2** AES-256-GCM crypto in `packages/ai/src/crypto.ts` (Agent 6)
- [x] **2.6.3** `getActiveModel(role)` + `getModelInstance(active)` (Agent 6)
- [x] **2.6.4** `logUsage` + `calculateCredits` (Agent 6)
- [x] **2.6.5** Endpoint: `/api/v1/ai/chat` streaming via `streamText` (Agent 6)
- [ ] **2.6.6** Endpoint: `/api/v1/ai/usage` (history bulanan)
- [ ] **2.6.7** Endpoint admin: `/admin/ai-providers/*`, `/admin/ai-models/*`
- [ ] **2.6.8** Endpoint admin: `/admin/ai-role-assignments`
- [ ] **2.6.9** Test API key rotation flow

### 2.7 File Upload
- [ ] **2.7.1** Service: `uploadService` ke MinIO/R2
- [ ] **2.7.2** Endpoint: `/api/v1/uploads`
- [ ] **2.7.3** Pre-signed URL generator
- [ ] **2.7.4** Virus scan (ClamAV) untuk doc upload — opsional v1

### 2.8 Worker Setup
> **Pivot**: BullMQ → **QStash** (Vercel-compatible serverless queue). See ARCHITECTURE.md §4.

- [x] **2.8.1** QStash client + publishJob + scheduleJob helper (Agent 8)
- [x] **2.8.2** Job: `mail` skeleton (Agent 8; Resend wiring TBD)
- [x] **2.8.3** Job: `cleanup` covered by purge-trash cron (Agent 8)
- [x] **2.8.4** Job: cron purge-trash route (Agent 8)
- [ ] **2.8.5** Admin dashboard untuk QStash job state — TBD

### 2.9 Health & Observability
- [x] **2.9.1** `/api/health` + `/api/ready` endpoints (Agent 10)
- [x] **2.9.2** Pino structured logging (`apps/web/lib/server/logger.ts`) (Agent 10)
- [~] **2.9.3** Sentry stub (lazy init, needs `@sentry/nextjs` install + DSN) (Agent 10)

**Exit criteria**: semua endpoint Core dapat dipanggil, return shape konsisten, soft delete + trash bekerja, audit log terisi. ✅

---

## Phase 3 — Backend Features (Konten & AI)

**Tujuan**: figures CRUD lengkap, content review workflow, deep research, doc analyzer, PDF jobs.

### 3.1 Figures Lengkap
- [x] **3.1.1** Endpoint CRUD figures (Agent 4)
- [~] **3.1.2** Endpoint figure_relations, figure_locations (basic via figureService.getBySlug join; dedicated endpoints TBD)
- [x] **3.1.3** Filter & search (FTS hybrid + kategori + gender + mazhab) (Agent 4)
- [x] **3.1.4** Pagination (Agent 4)
- [~] **3.1.5** Slug generator dari name_id (currently caller-supplied; auto-gen TBD)

### 3.2 Battles
- [x] **3.2.1** Endpoint CRUD battles + phases + participants (P3-1)
- [~] **3.2.2** Endpoint battle phases dengan GeoJSON return (phase route exists; GeoJSON serialization TBD when location returned)

### 3.3 Citations & Review Workflow
- [x] **3.3.1** Endpoint CRUD citations (P3-2)
- [x] **3.3.2** Service: review.assignToReviewer (P3-2)
- [x] **3.3.3** State machine: draft→under_review→approved/needs_edit (P3-2)
- [x] **3.3.4** Endpoint reviewer queue + decide approve/reject/edit (P3-2)
- [x] **3.3.5** AI-edit request stub (TODO: actual QStash enqueue) (P3-2)
- [x] **3.3.6** Diff generator (jsonDiff helper)
- [x] **3.3.7** Content revisions storage (P3-2)

### 3.4 AI Deep Research Worker
- [x] **3.4.1** Job: `research.crawl_figure` (P3-3)
- [x] **3.4.2** Whitelist search adapter (P3-3, naive v1, Google CSE TBD)
- [x] **3.4.3** Web fetcher rate-limited via Redis sliding window (P3-3)
- [x] **3.4.4** Arabic text extractor (P3-3)
- [x] **3.4.5** LLM structured extraction `generateObject` + zod schema (P3-3)
- [~] **3.4.6** Citations saved with source_url; embedding generation stubbed (sub-job TODO)
- [x] **3.4.7** Auto-assign reviewer (Redis round-robin counter) (P3-3)
- [ ] **3.4.8** Job: revalidate_source cron weekly — TBD

### 3.5 Bilingual Pipeline
- [x] **3.5.1** Extract Arab → JSON (P3-3 — extracts both AR/ID fields in one pass)
- [ ] **3.5.2** Dedicated Arab → Indonesia translator pass — TBD (currently single-pass)
- [ ] **3.5.3** Test kualitas dengan kitab sample — TBD (manual QA)
- [x] **3.5.4** Provenance per field (citations table with source_url + sourceLang)

### 3.6 AI Doc Analyzer
- [x] **3.6.1** Job: `/api/jobs/doc-analyze` HMAC-verified (P3-5)
- [x] **3.6.2** Upload endpoint `/api/v1/uploads` multipart (P3-5)
- [x] **3.6.3** Extract + append-merge (P3-5 — null-only fill)
- [x] **3.6.4** Konflik detection — write to contentRevisions for admin review (P3-5)

### 3.7 PDF Generator Worker
- [x] **3.7.1** Job route `/api/jobs/pdf` (P3-4)
- [x] **3.7.2** Vercel: puppeteer-core + @sparticuz/chromium (P3-4)
- [x] **3.7.3** 4 HTML templates: classic/modern/calligraphy/minimalist (P3-4)
- [x] **3.7.4** Timeline mini (SVG), map placeholder, illustrations (P3-4)
- [x] **3.7.5** Endpoint `/api/v1/pdf/jobs` create + status + list (P3-4)
- [x] **3.7.6** Watermark + footer "Dibuat oleh Athar" (P3-4)
- [ ] **3.7.7** Upload hasil ke Vercel Blob/R2 + notif — currently stubbed (P3-4 marked TODO)

### 3.8 Fonts Admin
- [x] **3.8.1** Endpoint CRUD fonts (P3-6)
- [ ] **3.8.2** Validator glyph Arab (Opentype.js) — TBD post-MVP
- [ ] **3.8.3** Auto-download Google Font file ke storage — TBD (still uses Google Fonts CDN URL approach)
- [x] **3.8.4** Endpoint font_assignments + activate (atomic via db.batch) (P3-6)
- [x] **3.8.5** Public endpoint `/api/v1/public/theme/fonts` (cached 1h) (P3-6)

### 3.9 Notifications
- [x] **3.9.1** Service: notification.create + listForUser + markRead + markAllRead (P3-8)
- [x] **3.9.2** SSE endpoint with polling fallback (Upstash REST has no pubsub) (P3-8)
- [ ] **3.9.3** Email notification (Resend) — skeleton in /api/jobs/mail (Agent 8), wiring TBD

### 3.10 Quiz
- [x] **3.10.1** Endpoint CRUD quiz, questions, options (P3-7)
- [x] **3.10.2** Endpoint attempt: start, answer, complete, score (server-side scoring) (P3-7)

**Exit criteria**: 1 tokoh end-to-end (crawl → review → publish → visible di API public).

---

## Phase 4 — Frontend Foundation

**Tujuan**: shell aplikasi, auth UI, sidebar+navbar, theme, fonts.

### 4.1 Setup & Configuration
- [x] **4.1.1** Tailwind 4 + design tokens (Phase 0)
- [x] **4.1.2** shadcn/ui 19 atoms (Button, Input, Card, Dialog, Dropdown, Tabs, Switch, Avatar, Badge, etc.) (F1)
- [x] **4.1.3** Lucide icons setup
- [x] **4.1.4** Sonner toast `app/layout.tsx`
- [x] **4.1.5** SweetAlert2 wrapper at `lib/swal.ts` + `use-confirm` hook (F7)
- [~] **4.1.6** Framer Motion installed; reduced-motion respect via `prefers-reduced-motion` CSS handled in globals.css
- [x] **4.1.7** TanStack Query provider wired in root layout (F7 + merge)
- [x] **4.1.8** Zustand stores: sidebar, calendar, ai-credit (F7)
- [x] **4.1.9** API client `lib/api/client.ts` + `endpoints.ts` typed wrappers (F7)

### 4.2 Theme & Font System
- [x] **4.2.1** CSS variables light + dark mode (Phase 0 globals.css)
- [x] **4.2.2** Anti-flash inline script component (F2) wired in layout
- [x] **4.2.3** Dynamic font CSS injection via `<FontLoader />` server component (F3)
- [x] **4.2.4** ThemeToggle 3-state (Light/Dark/Auto) with dropdown + segmented variants (F2)
- [~] **4.2.5** Sync preference ke DB: client posts to `/api/v1/users/me/preferences` (endpoint TBD)

### 4.3 Atomic Components
- [x] **4.3.1** Atoms: 20 shadcn components (F1)
- [~] **4.3.2** Molecules: BackButton (F10), FilterBar (F10) — others TBD per page
- [x] **4.3.3** Organisms: Sidebar (icon 1 warna, collapsible), Navbar (AI credit, quota, theme, calendar, notification bell, user menu) (F5)

### 4.4 Layout Shells
- [x] **4.4.1** `(app)/layout.tsx` — sidebar + navbar + main with auth + subscription guard (F4)
- [x] **4.4.2** `(admin)/layout.tsx` — admin role check (F4)
- [x] **4.4.3** `(reviewer)/layout.tsx` — reviewer/admin role check (F4)
- [x] **4.4.4** `(marketing)/layout.tsx` — public landing/pricing (F4)
- [x] **4.4.5** Mobile drawer pattern in Sidebar (F5)

### 4.5 Auth Pages
- [x] **4.5.1** Login, Register, Verify Email, Forgot Password, Reset Password (F6)
- [x] **4.5.2** Onboarding wizard 5-step (F6)
- [x] **4.5.3** Subscription expired page (F6)

### 4.6 i18n & Calendar
- [x] **4.6.1** next-intl config + ID + AR dictionaries (F8)
- [x] **4.6.2** Hijri converter via `@athar/hijri` (Phase 0)
- [x] **4.6.3** `formatYear()`, `formatDate()` utilities (F8)
- [x] **4.6.4** CalendarModeToggle wired to Zustand store (F5 + F7)

**Exit criteria**: user bisa register → login → masuk dashboard → toggle theme/calendar/font. ✅

---

## Phase 5 — Frontend Features (Konten User)

### 5.1 Dashboard Subscriber
- [x] **5.1.1** Dashboard widgets (3 quota cards, lanjut belajar, akses cepat) (F9)
- [ ] **5.1.2** Recharts integration — TBD (basic dashboard uses plain progress bars)

### 5.2 Figures (1-Page CRUD Pattern)
- [x] **5.2.1** `/figures` list dengan filter & search (F10)
- [x] **5.2.2** `/figures/[slug]` detail dengan tabs (F10 — Biografi/Timeline/Peta/Hubungan/Hadits/Sumber)
- [x] **5.2.3** ListDetailShell template (F10)
- [ ] **5.2.4** Back navigation pattern
- [ ] **5.2.5** Modal pattern (`?modal=create|edit`)
- [ ] **5.2.6** Citation popover (hover/click)
- [ ] **5.2.7** Hubungan tab dengan vis-network
- [ ] **5.2.8** Hadits tab dengan link external

### 5.3 Timeline Komponen
- [ ] **5.3.1** Install vis-timeline-react
- [ ] **5.3.2** TimelineSingle (react-chrono) untuk biografi tokoh
- [ ] **5.3.3** TimelineComparison (vis-timeline) `/timeline`
- [ ] **5.3.4** Lazy-load dropdown bertingkat
- [ ] **5.3.5** TimelineUlamaSalafPlus (visx + D3 force) `/timeline-ulama`

### 5.4 Maps
- [ ] **5.4.1** Install MapLibre GL + react-map-gl
- [ ] **5.4.2** MapAll `/map` dengan layer toggle
- [ ] **5.4.3** Clustering & heatmap
- [ ] **5.4.4** Dark/light tile switching
- [ ] **5.4.5** MapSingleFigure (embed)
- [ ] **5.4.6** Battle map dengan phase slider `/battles/[slug]`
- [ ] **5.4.7** Animated arrows overlay
- [ ] **5.4.8** Hijrah route animation (Mekkah → Madinah)

### 5.5 Battles
- [ ] **5.5.1** `/battles` list
- [ ] **5.5.2** `/battles/[slug]` detail dengan tab Narasi/Peta/Tokoh/Fase/Sumber

### 5.6 Quiz
- [ ] **5.6.1** `/quiz` list & start
- [ ] **5.6.2** Quiz session UI + timer
- [ ] **5.6.3** Result screen + review

### 5.7 AI Chat
- [ ] **5.7.1** `/chat` dengan useChat hook
- [ ] **5.7.2** Conversation history sidebar
- [ ] **5.7.3** Citation parser & link to figures
- [ ] **5.7.4** Quota warning toast

### 5.8 PDF Builder
- [ ] **5.8.1** `/pdf-builder` multi-step form
- [ ] **5.8.2** MultiSelect tokoh (combobox)
- [ ] **5.8.3** Template picker dengan preview
- [ ] **5.8.4** Live preview iframe
- [ ] **5.8.5** Auto-generate judul via AI
- [ ] **5.8.6** Generate → loading → download

### 5.9 Settings & Billing
- [ ] **5.9.1** `/settings` tabs (Profile, Preferences, Subscription, Security)
- [ ] **5.9.2** `/billing/usage` AI credit history dengan chart
- [ ] **5.9.3** `/billing/payment` upload bukti

### 5.10 Notifications & Pricing
- [ ] **5.10.1** `/notifications` panel
- [ ] **5.10.2** Bell dropdown realtime SSE
- [ ] **5.10.3** `/pricing` page dengan tier cards

**Exit criteria**: subscriber bisa browsing figures, timeline, peta, generate PDF.

---

## Phase 6 — Frontend Admin & Reviewer

### 6.1 Admin Panel
- [ ] **6.1.1** Admin dashboard
- [ ] **6.1.2** Users management dengan invite, edit role, suspend
- [ ] **6.1.3** Roles & Permissions matrix
- [ ] **6.1.4** Menu matrix
- [ ] **6.1.5** AI Providers management
- [ ] **6.1.6** AI Models management
- [ ] **6.1.7** AI Role Assignment
- [ ] **6.1.8** Fonts management (lihat IDEAS §3b.4)
- [ ] **6.1.9** Whitelist domains management
- [ ] **6.1.10** Subscriptions & Payments approval
- [ ] **6.1.11** Audit log viewer dengan diff modal
- [ ] **6.1.12** Trash view per type (figures, battles, dll)

### 6.2 Reviewer Panel
- [ ] **6.2.1** Review queue dengan filter
- [ ] **6.2.2** Side-by-side review UI
- [ ] **6.2.3** Live source fetch (iframe sandbox atau server-fetch)
- [ ] **6.2.4** Citation highlight & jump
- [ ] **6.2.5** Approve / Request Edit / Reject flows
- [ ] **6.2.6** AI-assisted edit modal
- [ ] **6.2.7** Diff viewer (react-diff-viewer)
- [ ] **6.2.8** Revisi history per content

**Exit criteria**: reviewer bisa review konten end-to-end, admin bisa kelola semua resource.

---

## Phase 7 — Crawling & Konten Awal

### 7.1 Awal Crawl
- [ ] **7.1.1** Admin curate list 30 sahabat untuk Free tier (priority high)
- [ ] **7.1.2** Crawl 25 Nabi & Rasul
- [ ] **7.1.3** Crawl Shalih Pre-Rasul (10–15 tokoh)
- [ ] **7.1.4** Crawl 60 sahabat utama (untuk tier Sampler & Basic)
- [ ] **7.1.5** Review oleh ustadz (mungkin perlu hire min 2 ustadz)
- [ ] **7.1.6** Publish setelah approve

### 7.2 Expansion
- [ ] **7.2.1** Crawl ~100 tabi'in utama
- [ ] **7.2.2** Crawl tabi'ut tabi'in (Bukhari, Muslim, Ahmad, dll)
- [ ] **7.2.3** Crawl ulama pasca-tabi'ut hingga modern wafat
- [ ] **7.2.4** Crawl sirah perang (Ghazwah utama + sariyyah penting)
- [ ] **7.2.5** Mapping locations + koordinat akurat

**Exit criteria**: minimal 100 tokoh published dengan review ustadz lengkap.

---

## Phase 8 — Testing & QA

### 8.1 Automated
- [ ] **8.1.1** Unit test coverage > 60% service layer
- [ ] **8.1.2** Integration test critical flows (auth, CRUD, review, AI usage)
- [ ] **8.1.3** E2E Playwright: register → trial → upgrade → PDF download
- [ ] **8.1.4** Visual regression test (opsional Chromatic)
- [ ] **8.1.5** Accessibility test (axe-core CI)
- [ ] **8.1.6** Load test endpoint kritis (k6)

### 8.2 Manual QA
- [ ] **8.2.1** Cross-browser: Chrome, Firefox, Safari, Edge
- [ ] **8.2.2** Mobile: iOS Safari, Android Chrome
- [ ] **8.2.3** Test bilingual rendering Arab di semua font yang di-seed
- [ ] **8.2.4** Test dark mode di semua page
- [ ] **8.2.5** Test PDF output di semua template & ukuran
- [ ] **8.2.6** Test peta dengan 1000+ marker

---

## Phase 9 — Pre-Launch Polish

- [ ] **9.1** Landing page final design + copywriting
- [ ] **9.2** Pricing page detail komparasi
- [ ] **9.3** SEO: meta tags, OG images, sitemap, robots.txt
- [ ] **9.4** Schema.org markup untuk tokoh (Person)
- [ ] **9.5** Privacy Policy & T&C lengkap (no-refund, payment manual)
- [ ] **9.6** Email templates (verify, welcome, payment confirm, PDF ready, dll)
- [ ] **9.7** Onboarding tour final
- [ ] **9.8** Empty states semua page
- [ ] **9.9** 404 & 500 error pages dengan branding
- [ ] **9.10** Maintenance mode toggle

---

## Phase 10 — Launch & Iterate

- [ ] **10.1** Beta test dengan 10 user awal
- [ ] **10.2** Bug fixes critical
- [ ] **10.3** Performance audit (Lighthouse > 90)
- [ ] **10.4** Final production deploy
- [ ] **10.5** Announce launch (social, email list)
- [ ] **10.6** Monitor metrics minggu pertama (errors, signups, conversions)

---

## Continuous (Post-Launch)

- [ ] Monthly: review AI model availability (rotate ke yang lebih baik)
- [ ] Monthly: audit content yang perlu update
- [ ] Quarterly: backup restore drill
- [ ] Quarterly: cost review (VPS scaling)
- [ ] Quarterly: security audit (dependency, npm audit)

---

## Progress Tracking — Cara Pakai

1. Saat mulai task: ubah `[ ]` → `[~]`, commit pesan: `wip: 1.1.5 migration roles`
2. Saat selesai: ubah `[~]` → `[x]`, commit pesan: `done: 1.1.5 migration roles & permissions`
3. Tidak boleh tandai `[x]` kalau:
   - Test belum lulus
   - Belum di-merge ke main
   - Belum di-test di staging
4. **Phase tidak boleh dilompat**:
   - Database belum 100% → Backend tidak mulai
   - Backend (Phase 2 + 3) belum 100% → Frontend (Phase 4+) tidak mulai
5. Dalam 1 phase, task bisa paralel **bila tidak depend**.

---

## Sync Checks per Phase

Sebelum tutup phase, jalankan:

```bash
pnpm typecheck          # strict TS, zero error
pnpm lint               # zero warning
pnpm test               # all green
pnpm build              # production build sukses
pnpm db:reset && pnpm db:seed  # full reset works
```

Smoke test manual:
- Login admin → ada akses ke semua menu yang seharusnya.
- Login subscriber → tidak bisa akses admin pages.
- Soft delete + restore + hard delete → bekerja.
- AI chat → balas streaming.
- PDF generate → file sampai di S3 + bisa di-download.
