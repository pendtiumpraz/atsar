# Atsar — Implementation Plan

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
- [x] **3.7.6** Watermark + footer "Dibuat oleh Atsar" (P3-4)
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
- [x] **5.1.2** Recharts integration — UsageChart on /billing/usage (P5-8)

### 5.2 Figures (1-Page CRUD Pattern)
- [x] **5.2.1** `/figures` list dengan filter & search (F10)
- [x] **5.2.2** `/figures/[slug]` detail dengan tabs (F10 — Biografi/Timeline/Peta/Hubungan/Hadits/Sumber)
- [x] **5.2.3** ListDetailShell template (F10)
- [x] **5.2.4** Back navigation pattern with filter preservation (F10)
- [~] **5.2.5** Modal pattern (`?modal=create|edit`) — admin actions TBD; subscribers don't edit figures
- [~] **5.2.6** Citation popover — basic citation chip exists; popover detail TBD
- [~] **5.2.7** Hubungan tab — currently stub; vis-network integration TBD
- [~] **5.2.8** Hadits tab — count + link stub; sunnah.com integration TBD

### 5.3 Timeline Komponen
- [x] **5.3.1** Install vis-timeline + react-chrono (Phase 5 dep install)
- [x] **5.3.2** TimelineSingle (react-chrono) — VERTICAL_ALTERNATING mode, dual-cal (P5-1)
- [x] **5.3.3** TimelineComparison (vis-timeline) `/timeline` (P5-2)
- [x] **5.3.4** Cascading lazy-load dropdown (sahabat→tabi'in→tabi'ut) (P5-2)
- [x] **5.3.5** TimelineUlamaSalafPlus `/timeline-ulama` — multi-generation lanes with filters (P5-2)

### 5.4 Maps
- [x] **5.4.1** MapLibre GL + react-map-gl installed (Phase 5 dep)
- [x] **5.4.2** MapAll `/map` dengan layer toggle (P5-3)
- [x] **5.4.3** Clustering (P5-3 — MapLibre cluster source)
- [x] **5.4.4** Dark/light tile switching (CARTO basemap, MutationObserver watching data-theme) (P5-3)
- [~] **5.4.5** MapSingleFigure (embed) — figure-marker component built; embedded usage in FigureDetail TBD
- [x] **5.4.6** Battle map dengan phase slider `/battles/[slug]` (P5-4)
- [x] **5.4.7** Animated arrows overlay (Framer Motion SVG) (P5-4)
- [x] **5.4.8** Hijrah route animation (GeoJSON LineString) (P5-3)

### 5.5 Battles
- [x] **5.5.1** `/battles` list with filters (P5-4)
- [x] **5.5.2** `/battles/[slug]` detail dengan tab Narasi/Peta/Tokoh/Fase/Sumber (P5-4)

### 5.6 Quiz
- [x] **5.6.1** `/quiz` list & start (P5-5)
- [x] **5.6.2** Quiz session UI + timer auto-submit (P5-5)
- [x] **5.6.3** Result screen + confetti + review (P5-5)

### 5.7 AI Chat
- [x] **5.7.1** `/chat` dengan useChat hook (Vercel AI SDK streaming) (P5-6)
- [x] **5.7.2** Conversation history sidebar (localStorage persistence) (P5-6)
- [x] **5.7.3** Citation parser & link to figures (URL regex extraction) (P5-6)
- [x] **5.7.4** Quota warning toast (Sonner) (P5-6)

### 5.8 PDF Builder
- [x] **5.8.1** `/pdf-builder` 4-step wizard form (P5-7)
- [x] **5.8.2** MultiSelect tokoh (search + chips, 2-60 enforced) (P5-7)
- [x] **5.8.3** Template picker dengan preview SVG placeholders (P5-7)
- [~] **5.8.4** Live preview iframe — TBD (cover preview component exists; full doc preview later)
- [~] **5.8.5** Auto-generate judul via AI — client-side placeholder (no AI title endpoint yet) (P5-7)
- [x] **5.8.6** Generate → idempotent submit → /jobs polling status → download (P5-7)

### 5.9 Settings & Billing
- [x] **5.9.1** `/settings` 4 tabs (Profile/Preferences/Subscription/Security) (P5-8)
- [x] **5.9.2** `/billing/usage` AI credit history dengan Recharts chart (P5-8)
- [x] **5.9.3** `/billing/payment` upload bukti pembayaran (P5-8)

### 5.10 Notifications & Pricing
- [x] **5.10.1** `/notifications` panel (P5-9)
- [x] **5.10.2** Bell dropdown + SSE/30s polling realtime (F5 + P5-9)
- [x] **5.10.3** `/pricing` page dengan tier cards + bulanan/tahunan toggle (F9)

**Exit criteria**: subscriber bisa browsing figures, timeline, peta, generate PDF. ✅

---

## Phase 6 — Frontend Admin & Reviewer

### 6.1 Admin Panel
- [x] **6.1.1** Admin dashboard /admin/dashboard with 6 metric cards + quick actions (A1)
- [x] **6.1.2** Users management /admin/users (CRUD, invite, edit roles, suspend) (A2)
- [x] **6.1.3** Roles & Permissions matrix /admin/roles (Tabs: matrix + manage) (A3)
- [x] **6.1.4** Menu access matrix /admin/menus (tree view + per-role switch grid) (A4)
- [x] **6.1.5** AI Providers management (provider list with enable/test/rotate) (A5)
- [x] **6.1.6** AI Models management (grouped table, prices, capabilities) (A5)
- [x] **6.1.7** AI Role Assignment (5 roles → model select) (A5)
- [x] **6.1.8** Fonts management /admin/fonts (active slots panel + all fonts + add font dialog) (A6)
- [x] **6.1.9** Whitelist domains management /admin/whitelist (A7)
- [x] **6.1.10** Subscriptions & Payments approval (1-click approve with auto-suggest tier) (A8)
- [x] **6.1.11** Audit log viewer /admin/audit-logs + diff modal with react-diff-viewer (A9)
- [x] **6.1.12** Trash view /admin/trash + per-type pages with bulk restore/hard delete (A10)

### 6.2 Reviewer Panel
- [x] **6.2.1** Review queue dengan filter (P5-10)
- [x] **6.2.2** Side-by-side review UI (P5-10)
- [x] **6.2.3** Live source fetch (iframe sandbox + fallback) (P5-10)
- [x] **6.2.4** Citation highlight & jump (P5-10)
- [x] **6.2.5** Approve / Request Edit / Reject flows (P5-10)
- [x] **6.2.6** AI-assisted edit modal (SweetAlert + API call) (P5-10)
- [x] **6.2.7** Diff viewer (react-diff-viewer-continued) (P5-10)
- [ ] **6.2.8** Revisi history per content (UI page TBD — backend has content_revisions table ready)

**Exit criteria**: reviewer bisa review konten end-to-end, admin bisa kelola semua resource. ✅

---

## Phase 7 — Crawling & Konten Awal

> **Status: SEEDED via deterministic seeders (bukan AI crawl).** Konten awal di-seed dari sumber salaf (Sirah Ibn Hisham, Al-Bidayah wan-Nihayah, Siyar A'lam an-Nubala', Kutub Sittah) untuk bootstrap database sebelum reviewer publish. AI crawler tetap akan dipakai untuk expansion masa depan via Phase 6 workflow.

### 7.1 Awal Crawl → Seed
- [x] **7.1.1** Curate list awal sahabat untuk Free/Sampler tier (30 sahabat utama + 21 shahabiyat seeded)
- [x] **7.1.2** Seed 24 Nabi & Rasul → `seeders/019_nabi_rasul.ts`
- [x] **7.1.3** Seed Shalih Pre-Rasul (12 tokoh: Khidir, Luqman, Maryam, Ashabul Kahfi, dll) → `seeders/020_shalih_pre_rasul.ts`
- [x] **7.1.4** Seed 30 sahabat utama + 21 shahabiyat → `seeders/021_sahabat_male.ts`, `seeders/022_shahabiyat.ts`
- [ ] **7.1.5** Review oleh ustadz — pending (dev reviewer account ready: `reviewer@atsar.local`)
- [ ] **7.1.6** Publish setelah approve — pending review workflow

### 7.2 Expansion
- [x] **7.2.1** Seed 29 tabi'in utama (7 Fuqaha Madinah, Hasan al-Bashri, Ibn Sirin, dll) → `seeders/023_tabiin.ts`
- [x] **7.2.2** Seed 29 tabi'ut tabi'in (4 Imam Mazhab + Kutub Sittah authors + Ahmad bin Hanbal) → `seeders/024_tabiut_tabiin.ts`
- [x] **7.2.3** Seed 32 ulama pasca-salaf (Nawawi, Ibn Taimiyyah, Ibn Qayyim, Bin Baz, Albani, Utsaimin, dll s/d 2026) → `seeders/025_ulama_pasca_salaf.ts`
- [x] **7.2.4** Seed 15 ghazwah + sariyyah utama (Badar, Uhud, Khandaq, Khaibar, Hunain, Tabuk, dll) → `seeders/026_ghazwah.ts`
- [x] **7.2.5** Seed 54 locations historis dengan koordinat (Mekkah, Madinah, Andalusia, Khurasan, dll) → `seeders/018_locations_extra.ts`
- [x] **7.2.6** Seed relasi: 109 figure_locations + 54 battle_participants + 78 figure_relations (guru-murid) → `seeders/027_relations.ts`

### 7.3 Dev Bootstrap & Demo
- [x] **7.3.1** Seed 3 dev users (admin/reviewer/subscriber) + reviewerProfile + premium trial → `seeders/028_dev_users.ts`
- [x] **7.3.2** Landing page spoiler — timeline komparatif (SVG, 6 tokoh) → `components/marketing/timeline-spoiler.tsx`
- [x] **7.3.3** Landing page spoiler — peta historis (SVG, 15 locations + Hijrah route) → `components/marketing/map-spoiler.tsx`

**Seed totals (per dry-run di Neon)**:
- 54 locations + 84 total (termasuk seed awal) = **84 locations**
- 24 nabi + 12 shalih + 30 sahabat + 21 shahabiyat + 29 tabi'in + 29 tabi'ut + 32 pasca = **172 figures**
- 15 ghazwah
- 109 figure_locations + 54 battle_participants + 78 figure_relations = **241 edges**
- 3 dev users

**Exit criteria**: ~~minimal 100 tokoh published dengan review ustadz lengkap~~ → **172 tokoh seeded (status: draft), siap review ustadz.** Phase 7.1.5 & 7.1.6 berpindah ke Phase 8 (review workflow live).

---

## Phase 7.5 — Post-Launch Audit Fixes (2026-05-13/14)

> Audit komprehensif setelah login pertama nyata. User menemukan banyak FE↔BE mismatch yang silent (empty data, broken nav). Diperbaiki via 3 swarm-agent paralel.

### 7.5.1 Auth + Login Resolution
- [x] **Better-auth drizzle adapter**: drop `usePlural:true` (caused `userss` lookup), add `crypto.randomUUID()` generator (DB columns are uuid), map `session.token → tokenHash`, drop snake_case field mappings (adapter resolves via Drizzle JS keys not SQL names). Commit `8f2de2c`.
- [x] **Admin/reviewer bypass subscription gate** via `getUserRoleSlugs()` + `STAFF_ROLES` check in `(app)/layout.tsx`. Commit `efb86cc`.
- [x] **RBAC Redis quota fallback**: tolerate Upstash 500k limit errors instead of 500ing every API. Commit `94bb819`.
- [x] **Global Redis Proxy**: wrap entire client with try/catch fallback (reads→null/[]/0, writes→silent). Commit `c648223`.

### 7.5.2 FE↔BE Contract Audit
- [x] **Category slug mismatch fix**: FE used `nabi-rasul`, `tabiut-tabiin`, `ulama-salaf`, `shahabiyat` but DB seeded `nabi`, `tabiut_tabiin`, `shalih_pasca_rasul`, gender-filter for shahabiyat. Fixed across 5 files (figure-filter-bar, map/layer-controls, 3 timeline components). Commit `6509664`.
- [x] **perPage max 100→250** in figure/battle schemas so timeline `perPage:200` queries return 200 OK instead of 422. Commit `c648223`.
- [ ] **Pagination envelope `.rows`**: 11 components destructure `data.rows` but client returns array directly (`figure-grid`, `comparison-picker`, `timeline-comparison`, `ulama-salaf-plus`, `pdf-builder/figure-picker`, `admin/users/user-table`, `admin/audit/audit-table`, `admin/trash/trash-table`, `pdf-builder/jobs page`, `billing/usage page`). **Status: TODO — high impact, fix next.**
- [ ] **snake_case ApiFigure typings**: `comparison-picker.tsx:27-35`, `timeline-comparison.tsx:35-49`, `ulama-salaf-plus.tsx:31-44` use `name_full_id` / `birth_date_ah` while API serializes camelCase. Timeline never renders bars. **Status: TODO**.
- [ ] **Phantom filter fields**: `ulama-salaf-plus` filters by `specializations` (real col: `specialty`), `mazhab` (real: `madhab`), `region` (doesn't exist on figures). Mazhab values `'Syafii'` vs DB `shafii`. **Status: TODO**.
- [ ] **PATCH vs PUT mismatch**: 9 admin update endpoints export `PUT` but FE calls `api.patch()` → 405 across the board (figures, battles, quizzes, locations, users, roles, fonts, whitelist; citations missing entirely). **Status: TODO — high impact, breaks every edit form**.
- [ ] **`db.transaction()` on Neon HTTP**: `user.service.invite/setRoles`, `role.service.setPermissions`, `menu.service.setRoleAccess`, `app/api/jobs/research` (legacy path). Throws at runtime. **Partial: fixed in figure ingest path; rest TODO**.

### 7.5.3 Admin Navigation & Login UX (commit `2894d1a`)
- [x] **`GET /api/v1/me/menu`** route — joins `menu_items × role_menu_access` for current user roles, returns ordered active items.
- [x] **`getMyRoleSlugs()` server action** for client components to read roles without bundling auth instance.
- [x] **Role-aware login redirect** in `login-form.tsx`: admin → `/admin/dashboard`, reviewer → `/queue`, else `/dashboard` (or `?from=` wins).
- [x] **"Admin Panel" item in UserMenu** — appears only if user has `admin` role.
- [x] **UserMenu rewrite**: use typed `useSession()` instead of broken `/api/auth/session` (better-auth endpoint is `/get-session`); use `authClient.signOut()` instead of raw fetch.
- [x] **6 missing menu_items seeded**: `admin-dashboard`, `admin-menus`, `admin-locations`, `admin-payments`, `admin-trash-figures`, `admin-trash-battles`. Admin role gets `*` access via 005_role_menu_access.
- [x] **AdminQuickActions extended** with links to roles, menus, subscriptions, locations, trash.
- Verified: `GET /api/v1/me/menu` returns 14 `/admin/*` items for admin cookie; 401 for unauth.

### 7.5.4 AI-Assisted Figure Ingest (commit `8aaf7b3`)
- [x] **Schema**: new table `research_jobs` + enums `research_job_type_enum` (figure_ingest/battle_ingest/location_ingest) + `research_job_status_enum`. Migration `0002_worried_boomer.sql` applied to Neon.
- [x] **`POST /api/v1/admin/figures/ingest`** — body `{name, category, gender?, hints?}`, returns 202 with jobId. Permission: `figures.create`.
- [x] **`GET /api/v1/admin/figures/ingest`** — recent jobs list (up to 50).
- [x] **`GET /api/v1/admin/figures/ingest-jobs/[jobId]`** — single-job poll.
- [x] **`/api/jobs/research` handler extended** to dispatch on `type: 'figure_ingest'` → loads job, fetches whitelist domains, runs `generateObject` against AI role `agent` with salaf-biographer system prompt + admin hints, writes `figures` row (status=draft) + citations rows, auto-assigns reviewer round-robin, queues embedding sub-job. `db.transaction` replaced with sequential inserts (Neon HTTP).
- [x] **Admin page `/admin/figures`** with "Tambah Tokoh (AI)" dialog: form (name, category, gender, hints) → POST → toast → poll every 5s → "Lihat draf" deep-link to `/admin/figures/[slug]/edit` on completion. Recent jobs panel at bottom.
- Local-dev caveat: QStash refuses to deliver to localhost (`endpoint resolves to a loopback address`). Production/Vercel preview works normally.

### 7.5.5 AI Provider Admin UI
- [x] `app/(admin)/admin/ai-providers/page.tsx` — providers tab + models tab + role-assignment matrix tab.
- [x] `app/(admin)/admin/ai-providers/[id]/page.tsx` — provider detail + models sub-table.
- [x] `GET/POST/PUT/PATCH/DELETE /api/v1/admin/ai-providers` (+ `/[id]/models`, `/[id]/rotate`, `/[id]/test`, `/ai-models`, `/ai-role-assignments`).
- [x] API key encryption at rest via `AI_MASTER_KEY` (AES-256-GCM) in `@athar/ai/crypto`; write-only field; never returned decrypted; only `apiKeyLast4` in responses.
- [x] Permission slugs `ai_providers.manage` + `ai_models.manage` already seeded (002_permissions.ts) and granted to admin in 003_role_permissions.ts.
- Status: completed in commit `abfee68`.

### 7.5.6 Ghazwah Coordinates Backfill (commit `ed7e61c`)
- [x] 2/15 battles missing `locationId` — Ghazwah Bani Mushtaliq + Ghazwah Hunain. Added `muraysi` location (23.50N, 38.95E), `hunayn` already existed. Verified 0/15 missing after backfill.

### 7.5.7 Landing Page Spoiler Fixes (commits `5af5dfc`, `59c6ebf`, `836c6f4`)
- [x] **MapSpoiler rebuild**: dropped stylized SVG band → MapLibre real CARTO basemap (light_all/dark_all theme-aware) with 9 historical region polygons (Hijaz/Najd/Yaman/Syam/Iraq/Misr/Khurasan/Andalusia/Maghrib) overlaid on actual world, 15 city pins with real lng/lat, Hijrah route dashed, NavigationControl + ScaleControl.
- [x] **Dynamic import isolation**: `next/dynamic({ssr:false})` cannot be called from Server Component → split into `map-spoiler-loader.tsx` (client wrapper) + interactive map.
- [x] **CARTO URL fix**: `/raster/voyager/...` path doesn't exist on CDN (404 → blank tiles) → use `/light_all/...` matching the in-app map.
- [x] **TimelineSpoiler**: `LABEL_GUTTER=240` + `PADDING_RIGHT=32`, subtitle fontSize 11→10 so "Imam al-Bukhari" + "Tabi'ut Tabi'in · 194 H – 256 H" fit.

**Phase 7.5 status**: 24/29 items completed. Remaining 5 items (3 FE↔BE TODOs + PATCH/PUT + db.transaction sweep) carried into Phase 8.

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
