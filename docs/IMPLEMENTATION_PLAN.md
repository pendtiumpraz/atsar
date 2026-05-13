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

- [ ] **0.1** Init monorepo dengan pnpm workspaces + Turborepo
- [ ] **0.2** Struktur folder: `apps/web`, `apps/worker`, `packages/db`, `packages/ai`, `packages/ui`, `packages/shared`, `packages/hijri`
- [ ] **0.3** Setup TypeScript strict, ESLint, Prettier, lint-staged + husky
- [ ] **0.4** Init Next.js 15 di `apps/web` dengan App Router
- [ ] **0.5** Init worker di `apps/worker` (Node + BullMQ)
- [ ] **0.6** Tailwind CSS 4 + shadcn/ui setup di `apps/web`
- [ ] **0.7** Buat `compose.yml` lokal: Postgres 16 + PostGIS + pgvector, Redis 7, MinIO
- [ ] **0.8** Buat `.env.example` lengkap (lihat BACKEND §15)
- [ ] **0.9** Setup GitHub repo, branch protection main
- [ ] **0.10** GitHub Actions CI: lint, typecheck, build, test
- [ ] **0.11** Setup Coolify di VPS Hetzner, deploy "hello world" sukses
- [ ] **0.12** Domain athar.app/.id pointing, TLS auto (Caddy/Coolify)
- [ ] **0.13** Setup Sentry (free tier) — frontend + backend
- [ ] **0.14** Setup pino logger struktur

**Exit criteria**: `pnpm dev` jalan lokal, deploy preview kerja, CI green.

---

## Phase 1 — Database Foundation

**Tujuan**: schema awal lengkap + seeders production-ready.

### 1.1 Schema Core (Drizzle)
- [ ] **1.1.1** Setup Drizzle config + connection pool
- [ ] **1.1.2** Enums: `date_precision_enum`, `rijal_grade_enum`, `font_role_enum`, `content_status_enum`
- [ ] **1.1.3** Migration: `users`, `sessions`, `password_reset_tokens`, `email_verification_tokens`
- [ ] **1.1.4** Migration: `roles`, `permissions`, `role_permissions`, `user_roles`
- [ ] **1.1.5** Migration: `menu_items`, `role_menu_access`
- [ ] **1.1.6** Migration: `reviewer_profiles`
- [ ] **1.1.7** Migration: `tiers`, `subscriptions`, `payments`, `quota_usage`
- [ ] **1.1.8** Migration: `figure_categories`, `figures` (lengkap dengan semua kolom DATABASE §4.2)
- [ ] **1.1.9** Migration: `figure_relations`, `figure_locations`
- [ ] **1.1.10** Migration: `locations` (dengan PostGIS GEOGRAPHY column)
- [ ] **1.1.11** Migration: `battles`, `battle_phases`, `battle_participants`, `battle_locations`
- [ ] **1.1.12** Migration: `whitelist_domains`, `citations`, `content_citation_embeddings` (pgvector)
- [ ] **1.1.13** Migration: `content_revisions`, `review_assignments`
- [ ] **1.1.14** Migration: `ai_providers`, `ai_models`, `ai_role_assignments`, `ai_usage_logs`
- [ ] **1.1.15** Migration: `fonts`, `font_assignments`, `font_assignment_history`
- [ ] **1.1.16** Migration: `pdf_jobs`, `pdf_templates`
- [ ] **1.1.17** Migration: `quizzes`, `quiz_questions`, `quiz_options`, `quiz_attempts`, `quiz_answers`
- [ ] **1.1.18** Migration: `notifications`
- [ ] **1.1.19** Migration: `audit_logs`
- [ ] **1.1.20** Index: semua partial index untuk soft delete (DATABASE §15)
- [ ] **1.1.21** Index: FTS bilingual untuk figures
- [ ] **1.1.22** Index: PostGIS GIST untuk locations
- [ ] **1.1.23** Index: pgvector HNSW untuk embeddings
- [ ] **1.1.24** Triggers: auto-update `updated_at`
- [ ] **1.1.25** Materialized view: `ai_usage_monthly_summary` + cron refresh

### 1.2 Seeders (Wajib, No Hardcoded)
- [ ] **1.2.1** `001_roles.ts` — admin, reviewer, subscriber
- [ ] **1.2.2** `002_permissions.ts` — semua slug
- [ ] **1.2.3** `003_role_permissions.ts` — matrix awal (BACKEND §5.5)
- [ ] **1.2.4** `004_menu_items.ts`
- [ ] **1.2.5** `005_role_menu_access.ts`
- [ ] **1.2.6** `006_tiers.ts` — Free, Sampler 29k, Basic 99k, Pro 299k, Premium 499k
- [ ] **1.2.7** `007_figure_categories.ts` — 6 kategori
- [ ] **1.2.8** `008_ai_providers.ts` — semua provider (DeepSeek active, lain inactive)
- [ ] **1.2.9** `009_ai_models.ts` — list model Mei 2026 (DATABASE §8.7)
- [ ] **1.2.10** `010_ai_role_assignments.ts` — DeepSeek V4 Flash default
- [ ] **1.2.11** `011_fonts.ts` — 15+ font seed
- [ ] **1.2.12** `012_font_assignments.ts` — sesuai BRANDING
- [ ] **1.2.13** `013_whitelist_domains.ts` — islamqa, dorar, dll
- [ ] **1.2.14** `014_pdf_templates.ts` — 4 template
- [ ] **1.2.15** `015_locations_core.ts` — Mekkah, Madinah, Yerusalem, dll (~50 lokasi)
- [ ] **1.2.16** `016_admin_user.ts` — buat admin awal dari ENV
- [ ] **1.2.17** `017_demo_figures.ts` — **HANYA dev** — beberapa tokoh contoh
- [ ] **1.2.18** Command: `pnpm db:seed`, `pnpm db:seed:dev`, `pnpm db:reset`
- [ ] **1.2.19** Test: jalankan `db:reset` dari scratch, semua green

### 1.3 Backup & Disaster Recovery
- [ ] **1.3.1** Cron `pg_dump` harian ke MinIO/R2 (retention 30 hari)
- [ ] **1.3.2** Cron weekly full dump (retention 1 tahun)
- [ ] **1.3.3** Test restore prosedur

**Exit criteria**: `pnpm db:reset && pnpm db:seed` sukses, semua tabel ada, semua seed terinsert.

---

## Phase 2 — Backend Core

**Tujuan**: auth, RBAC, service layer, audit log, soft delete, trash, error handling.

### 2.1 Auth & RBAC
- [ ] **2.1.1** Install & konfigurasi better-auth
- [ ] **2.1.2** Endpoint: register, login, logout, magic link, verify email, forgot/reset password
- [ ] **2.1.3** Session storage di DB + cookie
- [ ] **2.1.4** Middleware: `withAuth`, `requirePermission`, `requireRole`
- [ ] **2.1.5** Cache effective permissions di Redis (TTL 5 menit)
- [ ] **2.1.6** Service: `userService` CRUD users
- [ ] **2.1.7** Service: `roleService` manage roles & permissions
- [ ] **2.1.8** Endpoint: `/api/v1/admin/roles/*`, `/admin/permissions/*`, `/admin/menus/*`
- [ ] **2.1.9** Endpoint: `/api/v1/admin/users/*`
- [ ] **2.1.10** Test E2E auth flow

### 2.2 Service Pattern + Soft Delete
- [ ] **2.2.1** Buat `BaseService` template dengan soft delete methods
- [ ] **2.2.2** `figureService`: CRUD + softDelete + restore + hardDelete
- [ ] **2.2.3** `battleService`: same pattern
- [ ] **2.2.4** `locationService`: same pattern
- [ ] **2.2.5** Cascade soft delete logic (di transaction)
- [ ] **2.2.6** Endpoint trash: list, restore, hard-delete, empty
- [ ] **2.2.7** Cron: auto-purge trash > 30 hari

### 2.3 Audit Log
- [ ] **2.3.1** Service: `auditLog.write(...)` async
- [ ] **2.3.2** Endpoint: `/api/v1/admin/audit-logs` (paginated, filterable)
- [ ] **2.3.3** Integrate ke semua mutation service (figure, role, ai-provider, dll)

### 2.4 API Response & Error Handling
- [ ] **2.4.1** `withErrorHandling` wrapper
- [ ] **2.4.2** `ApiError` class
- [ ] **2.4.3** Response envelope helper
- [ ] **2.4.4** Validation middleware (zod)
- [ ] **2.4.5** Rate limiting middleware (Redis sliding window)
- [ ] **2.4.6** Idempotency key support

### 2.5 Subscription & Quota
- [ ] **2.5.1** `subscriptionService` create / activate / expire
- [ ] **2.5.2** `paymentService` register manual payment + admin approve
- [ ] **2.5.3** `quotaService` increment, check, reset
- [ ] **2.5.4** Cron daily: quota reset based on anniversary
- [ ] **2.5.5** Middleware `requireActiveSubscription`
- [ ] **2.5.6** Endpoint: `/api/v1/subscriptions/*`, `/admin/payments/*`

### 2.6 AI Service Layer
- [ ] **2.6.1** `packages/ai`: provider abstraction (Vercel AI SDK wrappers)
- [ ] **2.6.2** Secret encryption helper (AES-256-GCM with AI_MASTER_KEY)
- [ ] **2.6.3** Service: `aiService.getActiveModel(role)`
- [ ] **2.6.4** Service: `aiUsageService.log()` + credit calculation
- [ ] **2.6.5** Endpoint: `/api/v1/ai/chat` (streaming)
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
- [ ] **2.8.1** BullMQ workers running
- [ ] **2.8.2** Job: `mail.send_email` (Resend)
- [ ] **2.8.3** Job: `cleanup.purge_old_jobs`
- [ ] **2.8.4** Job: `cleanup.purge_trash`
- [ ] **2.8.5** Bull Board untuk admin debug

### 2.9 Health & Observability
- [ ] **2.9.1** `/api/health`, `/api/ready` endpoints
- [ ] **2.9.2** Pino structured logging integration
- [ ] **2.9.3** Sentry SDK integration di web + worker

**Exit criteria**: semua endpoint Core dapat dipanggil via curl/Postman, return shape konsisten, soft delete + trash bekerja, audit log terisi.

---

## Phase 3 — Backend Features (Konten & AI)

**Tujuan**: figures CRUD lengkap, content review workflow, deep research, doc analyzer, PDF jobs.

### 3.1 Figures Lengkap
- [ ] **3.1.1** Endpoint CRUD figures (list, detail-by-slug, create, update, delete)
- [ ] **3.1.2** Endpoint figure_relations, figure_locations
- [ ] **3.1.3** Filter & search (FTS bilingual, kategori, gender, mazhab, dll)
- [ ] **3.1.4** Pagination & cursor
- [ ] **3.1.5** Slug generator dari name_id (transliterate)

### 3.2 Battles
- [ ] **3.2.1** Endpoint CRUD battles + phases + participants
- [ ] **3.2.2** Endpoint battle phases dengan GeoJSON return

### 3.3 Citations & Review Workflow
- [ ] **3.3.1** Endpoint CRUD citations
- [ ] **3.3.2** Service: `reviewService.assignReviewer()`
- [ ] **3.3.3** State machine logic (draft → under_review → ...)
- [ ] **3.3.4** Endpoint reviewer: list assignments, get review, decide
- [ ] **3.3.5** Endpoint reviewer AI-assisted edit (enqueue job)
- [ ] **3.3.6** Diff generator (jsondiffpatch)
- [ ] **3.3.7** Content revision storage

### 3.4 AI Deep Research Worker
- [ ] **3.4.1** Job: `research.crawl_figure` (lihat BACKEND §8.2)
- [ ] **3.4.2** Whitelist search adapter per domain
- [ ] **3.4.3** Web fetcher dengan rate limit
- [ ] **3.4.4** Arabic text extractor
- [ ] **3.4.5** LLM structured extraction (`generateObject`)
- [ ] **3.4.6** Citation saving + embedding generation
- [ ] **3.4.7** Auto-assign reviewer (round-robin atau by specialty)
- [ ] **3.4.8** Job: `research.revalidate_source` (cron weekly)

### 3.5 Bilingual Pipeline
- [ ] **3.5.1** Service: extract Arab → structured JSON
- [ ] **3.5.2** Service: translate Arab → Indonesia (preserve nama & istilah syar'i)
- [ ] **3.5.3** Test kualitas dengan kitab sample
- [ ] **3.5.4** Provenance per field (source_url, status: ai-translated)

### 3.6 AI Doc Analyzer
- [ ] **3.6.1** Job: `doc.analyze_doc`
- [ ] **3.6.2** Endpoint upload + dispatch
- [ ] **3.6.3** Extract tokoh + atribut, append-merge ke DB
- [ ] **3.6.4** Konflik detection → flag manual review

### 3.7 PDF Generator Worker
- [ ] **3.7.1** Job: `pdf.generate_pdf`
- [ ] **3.7.2** Puppeteer setup di Docker (font Arab pre-installed: Amiri, Cairo, Noto Naskh, fonts-kacst)
- [ ] **3.7.3** HTML template engine (per template: classic, modern, calligraphy, minimal)
- [ ] **3.7.4** Render timeline mini, peta mini, illustrasi CSS, citation
- [ ] **3.7.5** Endpoint: `/api/v1/pdf/jobs` create + status
- [ ] **3.7.6** Watermark + footer "Dibuat oleh Athar"
- [ ] **3.7.7** Upload hasil ke MinIO + notif

### 3.8 Fonts Admin
- [ ] **3.8.1** Endpoint CRUD fonts
- [ ] **3.8.2** Validator: font Arab wajib punya glyph Arab (Opentype.js)
- [ ] **3.8.3** Auto-download Google Font file ke storage
- [ ] **3.8.4** Endpoint font_assignments
- [ ] **3.8.5** Endpoint public: `/api/v1/public/theme/fonts`

### 3.9 Notifications
- [ ] **3.9.1** Service: `notificationService.create`
- [ ] **3.9.2** SSE endpoint untuk realtime push
- [ ] **3.9.3** Email notification (subscription expiring, dll)

### 3.10 Quiz
- [ ] **3.10.1** Endpoint CRUD quiz, questions, options
- [ ] **3.10.2** Endpoint attempt: start, answer, complete, score

**Exit criteria**: 1 tokoh end-to-end (crawl → review → publish → visible di API public).

---

## Phase 4 — Frontend Foundation

**Tujuan**: shell aplikasi, auth UI, sidebar+navbar, theme, fonts.

### 4.1 Setup & Configuration
- [ ] **4.1.1** Tailwind 4 + design tokens dari UI_UX.md
- [ ] **4.1.2** shadcn/ui install component basic (Button, Input, Card, Dialog, Dropdown, Tabs, ...)
- [ ] **4.1.3** Lucide icons setup
- [ ] **4.1.4** Sonner toast setup di `app/layout.tsx`
- [ ] **4.1.5** SweetAlert2 + wrapper custom (FRONTEND §6)
- [ ] **4.1.6** Framer Motion + reduced-motion respect
- [ ] **4.1.7** TanStack Query provider
- [ ] **4.1.8** Zustand stores: theme, calendar, sidebar
- [ ] **4.1.9** API client (`lib/api`) dengan fetch wrapper + auth header

### 4.2 Theme & Font System
- [ ] **4.2.1** CSS variables light + dark mode (BRANDING §4, §4b)
- [ ] **4.2.2** Anti-flash inline script di `<head>`
- [ ] **4.2.3** Dynamic font CSS injection dari `/api/v1/public/theme/fonts`
- [ ] **4.2.4** ThemeToggle component (3-state: Light/Dark/Auto)
- [ ] **4.2.5** Sync preference ke DB on change

### 4.3 Atomic Components
- [ ] **4.3.1** Atoms: Button, Input, Label, Badge, Avatar, Spinner, Skeleton, Switch, Checkbox, Radio
- [ ] **4.3.2** Molecules: FormField, SearchBox, BackButton, Breadcrumb, EmptyState, Card, Pagination, DateRangePicker, CalendarModeToggle, LanguageSelector
- [ ] **4.3.3** Organisms: Sidebar (collapsible, icon 1 warna), Navbar (AI credit chip, quota, theme, calendar, notification, user menu)

### 4.4 Layout Shells
- [ ] **4.4.1** `(app)/layout.tsx` — sidebar + navbar + main
- [ ] **4.4.2** `(admin)/layout.tsx`
- [ ] **4.4.3** `(reviewer)/layout.tsx`
- [ ] **4.4.4** `(marketing)/layout.tsx` (public)
- [ ] **4.4.5** Mobile drawer pattern

### 4.5 Auth Pages
- [ ] **4.5.1** Login, Register, Verify Email, Forgot Password
- [ ] **4.5.2** Onboarding wizard (5 step)
- [ ] **4.5.3** Subscription expired page

### 4.6 i18n & Calendar
- [ ] **4.6.1** next-intl setup dengan ID + AR dictionaries
- [ ] **4.6.2** Hijri converter integration (`packages/hijri`)
- [ ] **4.6.3** `formatYear()`, `formatDate()` utilities
- [ ] **4.6.4** CalendarModeToggle wired ke store

**Exit criteria**: user bisa register → login → masuk dashboard → toggle theme/calendar/font.

---

## Phase 5 — Frontend Features (Konten User)

### 5.1 Dashboard Subscriber
- [ ] **5.1.1** Dashboard widgets (quota cards, lanjut belajar, akses cepat)
- [ ] **5.1.2** Recharts integration

### 5.2 Figures (1-Page CRUD Pattern)
- [ ] **5.2.1** `/figures` list dengan filter & search
- [ ] **5.2.2** `/figures/[slug]` detail dengan tabs
- [ ] **5.2.3** ListDetailShell template
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
