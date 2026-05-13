# Athar — Frontend Architecture & Conventions

> Next.js 15 (App Router) + TypeScript strict.
> Lihat `WIREFRAMES.md` untuk wireframe per fitur, `UI_UX.md` untuk design system, `BRANDING.md` untuk palette & typography.

---

## 1. Prinsip Inti

1. **Atomic Design** — komponen berlapis (atoms → molecules → organisms → templates → pages).
2. **Server Components default**, Client Components hanya saat butuh interactivity / state.
3. **CRUD 1-page pattern** — list + detail dalam route yang sama, slug berubah saat lihat detail, ada tombol back.
4. **No dummy data hardcoded** — semua data dari API.
5. **Form-validation = Backend-validation** — pakai zod schema yang sama di kedua sisi.
6. **Accessibility** — WCAG AA minimum (keyboard nav, ARIA, kontras).
7. **No flash** — anti-FOUC pada theme switching & font loading.

---

## 2. Tech Stack Inti

| Layer | Library | Versi | Catatan |
|---|---|---|---|
| Framework | **Next.js (App Router)** | 15.x | RSC, Server Actions, streaming |
| Bahasa | TypeScript strict | 5.x | |
| Styling | **Tailwind CSS** | 4.x | atomic utility |
| UI Components | **shadcn/ui** | latest | unstyled radix + tailwind, fully customizable |
| Icons | **lucide-react** | latest | 1 warna konsisten (sesuai branding sidebar) |
| Form | **react-hook-form** + zod | latest | shared schema |
| Modal Konfirmasi | **SweetAlert2** + sweetalert2-react-content | latest | per user instruction |
| Toast Notifications | **Sonner** | latest | shadcn standard, modern UX |
| Animation | **Framer Motion** | latest | smooth transitions |
| Server State | **TanStack Query (v5)** | latest | caching, mutations |
| Client State | **Zustand** | latest | global state |
| AI Streaming | **Vercel AI SDK** | latest | useChat hook |
| Maps | **MapLibre GL JS** + react-map-gl | latest | WebGL, no API key, vector tiles |
| Timeline | **vis-timeline** (komparasi) + react-chrono (storytelling) + **visx** (custom) | latest | pilihan per use case |
| Date | **dayjs** + plugin hijri + custom converter | latest | dwi-kalender |
| Markdown render | **react-markdown** + remark-gfm | latest | konten biografi |
| Code highlight | **shiki** | latest | admin only |
| Drag & drop | **dnd-kit** | latest | reorder list |
| i18n | **next-intl** | latest | Indonesia + Arab |
| Tests | **vitest** + Playwright | latest | unit + E2E |

---

## 3. Folder Structure (apps/web)

```
apps/web/
├── app/
│   ├── (marketing)/                # public, SSG/ISR
│   │   ├── page.tsx                # landing
│   │   ├── pricing/page.tsx
│   │   ├── about/page.tsx
│   │   └── kontak/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── verify-email/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (app)/                      # subscriber area (auth required)
│   │   ├── layout.tsx              # sidebar + navbar
│   │   ├── dashboard/page.tsx
│   │   ├── figures/
│   │   │   ├── page.tsx            # list + detail (1-page pattern)
│   │   │   └── [slug]/page.tsx     # deep link langsung ke slug
│   │   ├── battles/
│   │   ├── timeline/
│   │   ├── timeline-ulama/
│   │   ├── map/
│   │   ├── quiz/
│   │   ├── chat/                   # AI chat
│   │   ├── pdf-builder/
│   │   ├── notifications/
│   │   ├── settings/
│   │   └── billing/
│   ├── (reviewer)/
│   │   ├── layout.tsx
│   │   ├── queue/page.tsx
│   │   └── review/[id]/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── users/page.tsx
│   │   ├── roles/page.tsx
│   │   ├── menus/page.tsx          # menu matrix
│   │   ├── ai-providers/page.tsx
│   │   ├── ai-models/page.tsx
│   │   ├── fonts/page.tsx
│   │   ├── whitelist/page.tsx
│   │   ├── subscriptions/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── audit-logs/page.tsx
│   │   └── trash/
│   │       └── [type]/page.tsx
│   ├── api/                        # API routes (lihat BACKEND.md)
│   ├── layout.tsx                  # root: theme, fonts, providers
│   └── globals.css
│
├── components/
│   ├── atoms/                      # button, input, badge, icon, label, ...
│   ├── molecules/                  # form-field, search-box, card-header, ...
│   ├── organisms/                  # data-table, sidebar, navbar, ai-chat-panel, ...
│   ├── templates/                  # page-shell, list-detail-shell, ...
│   ├── modals/                     # konfirmasi SweetAlert wrappers
│   ├── timeline/                   # timeline-comparison, timeline-story, ...
│   ├── map/                        # map-view, map-marker, battle-map, ...
│   ├── pdf-preview/                # iframe preview & template selector
│   └── shared/
│
├── hooks/                          # useTheme, useFonts, useAICredits, useQuota, ...
├── lib/
│   ├── api/                        # client API wrappers (fetch with TQ)
│   ├── server/                     # server-side utilities (di BACKEND.md)
│   ├── shared/                     # types, validators (zod), constants
│   ├── i18n/                       # locale dictionary
│   ├── theme/                      # token & resolver
│   └── utils/
│       ├── hijri.ts                # H↔M converter
│       ├── format-date.ts
│       ├── rijal-label.ts
│       └── slug.ts
│
├── store/                          # zustand stores
├── styles/                         # tailwind config + tokens
└── public/
    └── fonts/                      # initial seed fonts (downloaded server-side)
```

---

## 4. Atomic Design — Tingkatan

### Atoms (paling basic, 1 elemen)
`Button`, `Input`, `Label`, `Badge`, `Avatar`, `Icon`, `Divider`, `Spinner`, `Skeleton`, `Kbd`, `Tooltip`, `Switch`, `Checkbox`, `RadioButton`, `ProgressBar`, `Tag`, `Chip`.

### Molecules (2-3 atoms)
`FormField` (Label + Input + Error), `SearchBox`, `BackButton`, `DateRangePicker`, `LanguageSelector`, `ThemeToggle`, `CalendarModeToggle`, `Pagination`, `Breadcrumb`, `EmptyState`, `Card`, `CitationLink`.

### Organisms (kompleks, beberapa molecules)
`Sidebar`, `Navbar`, `DataTable`, `FigureCard`, `BiographyPanel`, `TimelineComparison`, `MapView`, `PDFBuilder`, `AIChatPanel`, `AIcreditChip`, `QuizQuestion`, `ReviewPanel`.

### Templates
`PageShell` (header + sidebar + main), `ListDetailShell` (split-pane), `DashboardShell`, `MarketingShell`.

### Pages
Tinggal compose dari templates + data fetching.

---

## 5. CRUD 1-Page Pattern (Critical Convention)

User instruction: **list + detail di 1 page, slug berubah saat detail, ada back**.

### URL Strategy
```
/figures                          → List view (default)
/figures?q=abu&category=sahabat   → List dengan filter
/figures/abu-bakr-as-shiddiq      → Detail view (slug)
/figures?modal=create             → Modal create (overlay)
/figures/abu-bakr-as-shiddiq?modal=edit  → Modal edit
```

### Implementasi (`app/(app)/figures/page.tsx` + `[slug]/page.tsx`)
```tsx
// Both pages use the same shell
export default function FiguresPage({ params, searchParams }: Props) {
  const slug = params?.slug
  const query = searchParams.q
  const modal = searchParams.modal

  return (
    <ListDetailShell>
      <ListDetailShell.List>
        <FigureFilterBar />
        <FigureGrid query={query} selectedSlug={slug} />
      </ListDetailShell.List>

      {slug ? (
        <ListDetailShell.Detail>
          <BackButton href="/figures" />
          <FigureDetail slug={slug} />
        </ListDetailShell.Detail>
      ) : (
        <ListDetailShell.Empty>
          Pilih tokoh dari daftar
        </ListDetailShell.Empty>
      )}

      {modal === 'create' && <FigureCreateModal />}
      {modal === 'edit' && <FigureEditModal slug={slug} />}
    </ListDetailShell>
  )
}
```

### Back Navigation
- Tombol `<` di kiri atas detail panel.
- Klik → `router.push('/figures')` (preserve filter dari `searchParams.q`).
- Browser back juga jalan (Next.js router otomatis).

### Modal Triggers
- `?modal=create` → buka modal create
- `?modal=edit` → buka modal edit (require slug)
- Modal close → `router.replace(pathnameWithoutModalParam)`.

### Mobile
- Mobile: list & detail **stack** (bukan side-by-side). Tap item → push detail.
- Desktop (≥1024px): side-by-side split.

---

## 6. SweetAlert2 Pattern (Konfirmasi & Form Modal)

User instruction: **seluruh modal pakai SweetAlert**.

### Wrapper Custom
```tsx
// components/modals/swal.ts
import Swal from 'sweetalert2'
import withReactContent from 'sweetalert2-react-content'

export const MySwal = withReactContent(Swal)

// Pre-styled per palette
export const confirm = (opts: ConfirmOpts) => MySwal.fire({
  title: opts.title,
  text: opts.text,
  icon: opts.icon ?? 'question',
  showCancelButton: true,
  confirmButtonText: opts.confirmText ?? 'Ya',
  cancelButtonText: 'Batal',
  buttonsStyling: false,
  customClass: {
    popup: 'athar-swal-popup',           // pakai tokens
    confirmButton: 'btn btn-primary',
    cancelButton: 'btn btn-outline',
    title: 'font-display-latin',
  },
  showClass: { popup: 'animate__animated animate__fadeIn' },
  ...opts,
})

export const deleteConfirm = async (resource: string) => {
  const result = await confirm({
    title: `Hapus ${resource}?`,
    text: 'Item akan masuk ke Trash. Bisa di-restore kemudian.',
    icon: 'warning',
    confirmText: 'Ya, hapus',
  })
  return result.isConfirmed
}

export const hardDeleteConfirm = async (resource: string) => {
  const result = await MySwal.fire({
    title: `Hapus Permanen ${resource}?`,
    text: 'Tindakan ini TIDAK BISA dibatalkan. Ketik "HAPUS" untuk konfirmasi.',
    icon: 'error',
    input: 'text',
    inputValidator: (v) => v !== 'HAPUS' ? 'Ketik tepat "HAPUS"' : null,
    showCancelButton: true,
    confirmButtonText: 'Hapus Permanen',
  })
  return result.isConfirmed
}
```

### Usage
```tsx
async function onDelete(figure: Figure) {
  if (await deleteConfirm(figure.name_id)) {
    await api.figures.softDelete(figure.id)
    toast.success(`${figure.name_id} dipindahkan ke Trash`)
    queryClient.invalidateQueries({ queryKey: ['figures'] })
  }
}
```

### Theming Sweet Alert (Light/Dark)
SweetAlert2 popup pakai class `athar-swal-popup` yang reads CSS variables — auto-switch saat dark/light mode toggled.

```css
/* globals.css */
.athar-swal-popup {
  background: var(--bg-surface);
  color: var(--text);
  font-family: var(--font-body-latin);
  border: 1px solid var(--border);
  border-radius: 1rem;
}
```

---

## 7. Toast Pattern (Sonner)

```tsx
// app/layout.tsx
import { Toaster } from 'sonner'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster
          position="top-right"
          theme="system"
          richColors
          closeButton
          toastOptions={{ classNames: { toast: 'athar-toast' } }}
        />
      </body>
    </html>
  )
}

// usage:
import { toast } from 'sonner'

toast.success('Berhasil disimpan')
toast.error('Gagal', { description: errMsg })
toast.loading('Sedang generate PDF...', { id: 'pdf-1' })
toast.success('PDF siap', { id: 'pdf-1', action: { label: 'Download', onClick } })
```

---

## 8. Theme System (Light/Dark/Auto)

### Implementation
```tsx
// app/layout.tsx — anti-flash script
<head>
  <script dangerouslySetInnerHTML={{ __html: `
    (function() {
      const stored = localStorage.getItem('theme') || 'auto'
      const isDark = stored === 'dark' || (stored === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    })()
  ` }} />
</head>
```

### Hook
```tsx
// hooks/useTheme.ts
export function useTheme() {
  const [theme, setTheme] = useState<'light'|'dark'|'auto'>(/* read */)
  useEffect(() => {
    const isDark = theme === 'dark' || (theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    localStorage.setItem('theme', theme)
    // Sync ke DB via API
    api.users.updatePreferences({ theme })
  }, [theme])
  return { theme, setTheme }
}
```

### CSS Variables (lihat BRANDING.md §4 & 4b)
```css
:root[data-theme="light"] { --bg: #FAF5EB; --text: #1F1810; ... }
:root[data-theme="dark"]  { --bg: #0F0D0A; --text: #FAF5EB; ... }
```

---

## 9. Font System (Dynamic Loading)

Karena admin bisa ganti font (§3b IDEAS), font loading dilakukan dinamis:

```tsx
// app/layout.tsx
async function getFontConfig() {
  const res = await fetch('/api/v1/public/theme/fonts', { next: { revalidate: 3600 }})
  return res.json()
}

export default async function RootLayout({ children }) {
  const fonts = await getFontConfig()
  return (
    <html>
      <head>
        {fonts.googleFonts.length > 0 && (
          <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${buildGoogleFontsUrl(fonts.googleFonts)}`} />
        )}
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --font-display-latin: ${fonts.display_latin};
            --font-body-latin: ${fonts.body_latin};
            --font-display-arab: ${fonts.display_arab};
            --font-section-arab: ${fonts.section_arab};
            --font-body-arab: ${fonts.body_arab};
            --font-quran-arab: ${fonts.quran_arab};
            --font-mono: ${fonts.mono};
          }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

### Usage di Tailwind Config
```ts
// tailwind.config.ts
fontFamily: {
  'display-latin': 'var(--font-display-latin)',
  'body-latin': 'var(--font-body-latin)',
  'display-arab': 'var(--font-display-arab)',
  'body-arab': 'var(--font-body-arab)',
  'quran-arab': 'var(--font-quran-arab)',
  mono: 'var(--font-mono)',
}
```

### Component Pattern untuk Konten Bilingual
```tsx
<h1 className="font-display-arab text-4xl" dir="rtl">{figure.name_full_ar}</h1>
<h2 className="font-display-latin text-2xl">{figure.name_full_id}</h2>

<p className="font-body-arab text-lg leading-loose" dir="rtl">{figure.biography_ar}</p>
<p className="font-body-latin">{figure.biography_id}</p>
```

---

## 10. Calendar Mode Toggle

### Hook
```tsx
// hooks/useCalendar.ts
import { useCalendarStore } from '@/store/calendar'

export function useCalendar() {
  const { mode, setMode } = useCalendarStore() // 'h' | 'm' | 'both'
  return { mode, setMode }
}
```

### Display Utility
```tsx
// utils/format-date.ts
export function formatYear({ ah, ce, mode }: { ah?: number; ce?: number; mode: CalMode }) {
  switch (mode) {
    case 'h': return ah ? `${ah} H` : '-'
    case 'm': return ce ? `${ce} M` : '-'
    case 'both': return `${ah ?? '?'} H / ${ce ?? '?'} M`
  }
}
```

---

## 11. Sidebar (Icon Single-Color)

User instruction: **sidebar pakai icon dengan 1 warna**.

```tsx
// components/organisms/Sidebar.tsx
<aside className="sidebar">
  <nav>
    {menuItems.map(item => (
      <Link key={item.slug} href={item.path}
        className={cn('sidebar-link', isActive(item) && 'active')}>
        <Icon name={item.icon}
          className="text-sidebar-icon"   // semua icon 1 warna via CSS var
          size={20} strokeWidth={1.75} />
        <span className="sidebar-label">{item.label}</span>
      </Link>
    ))}
  </nav>
</aside>
```

```css
/* tokens */
:root[data-theme="light"] {
  --sidebar-icon: var(--text-muted);          /* 1 warna konsisten */
  --sidebar-icon-active: var(--accent);       /* hanya active state */
}
:root[data-theme="dark"] {
  --sidebar-icon: var(--cream-muted);
  --sidebar-icon-active: var(--gold-warm);
}
```

### Collapsible
- Mode expanded (label + icon, default 240px width).
- Mode collapsed (icon only, 64px width). Toggle via tombol di bottom sidebar.
- Mobile: drawer slide-in.

---

## 12. Navbar (AI Credit + History + Quota)

User instruction: **navbar ada AI credit, history usage, monthly reset, perhitungan quota**.

### Komponen
```tsx
<nav className="navbar">
  <Breadcrumb />

  <div className="navbar-right">
    <AICreditChip />           {/* sisa credit bulan ini */}
    <QuotaIndicator />          {/* PDF & AI chat sisa */}
    <NotificationBell />
    <ThemeToggle />
    <CalendarModeToggle />
    <UserMenu />               {/* dropdown: settings, billing, logout */}
  </div>
</nav>
```

### AI Credit Chip
```tsx
<AICreditChip>
  ✨ 1,234 / 5,000 credits
  <Tooltip>
    Bulan ini: 18 chat, 4 PDF
    Reset: 7 Jun 2026
  </Tooltip>
  <Link href="/billing/ai-usage">Detail</Link>
</AICreditChip>
```

### Detail History Page (`/billing/ai-usage`)
- Tabel `ai_usage_logs` user, paginated, filterable per role (chat/agent/doc).
- Chart bulanan (credits used per role).
- Reset date countdown.
- Filter: dateRange, role, model.

### Quota Indicator
```tsx
<QuotaIndicator>
  PDF: 47/100 · Chat: 12/50
</QuotaIndicator>
```

Klik → modal/page detail quota.

---

## 13. Data Fetching Pattern

### Server Components (default)
```tsx
// page.tsx (server)
export default async function FiguresPage() {
  const { data } = await api.figures.list({ limit: 20 })
  return <FigureGrid initialData={data} />
}
```

### Client Components dengan TanStack Query
```tsx
'use client'
export function FigureGrid({ initialData }) {
  const { data, isLoading } = useQuery({
    queryKey: ['figures', filters],
    queryFn: () => api.figures.list(filters),
    initialData,
  })
  // ...
}
```

### Mutations
```tsx
const mutation = useMutation({
  mutationFn: api.figures.create,
  onSuccess: () => {
    toast.success('Tokoh berhasil dibuat')
    queryClient.invalidateQueries({ queryKey: ['figures'] })
  },
  onError: (err) => toast.error('Gagal', { description: err.message }),
})
```

---

## 14. AI Streaming (Vercel AI SDK)

```tsx
'use client'
import { useChat } from 'ai/react'

export function AIChat() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/v1/ai/chat',
  })
  // stream UI...
}
```

Endpoint server (lihat BACKEND.md §6.2) return `result.toDataStreamResponse()`.

---

## 15. Performance Practices

- **Image**: `next/image` dengan AVIF/WebP, lazy load by default.
- **Font**: `next/font` untuk fallback, dynamic CSS injection untuk custom font (§9).
- **Code splitting**: dynamic import untuk `MapView`, `Timeline`, `PDFBuilder` (heavy).
- **Bundle analysis**: `@next/bundle-analyzer` di CI.
- **Caching**: ISR untuk pages marketing, dynamic untuk app routes.
- **Prefetch**: Link prefetch otomatis di Next.js.
- **List virtualization**: TanStack Virtual untuk list > 100 items.

---

## 16. Accessibility Checklist

- [ ] Keyboard navigation di seluruh interactive elements.
- [ ] Focus visible (ring, outline) — jangan disable.
- [ ] ARIA labels untuk icon-only buttons.
- [ ] Semantic HTML (`<nav>`, `<main>`, `<article>`, dst).
- [ ] Kontras WCAG AA (4.5:1 body, 3:1 large text).
- [ ] Alt text untuk image.
- [ ] `lang` attribute per blok bahasa (`lang="ar" dir="rtl"`).
- [ ] Screen reader testing dengan NVDA/VoiceOver.
- [ ] `prefers-reduced-motion` respect.

---

## 17. i18n (next-intl)

```tsx
// lib/i18n/messages/id.json
{ "common.save": "Simpan", "common.cancel": "Batal", ... }

// lib/i18n/messages/ar.json
{ "common.save": "حفظ", "common.cancel": "إلغاء", ... }
```

```tsx
import { useTranslations } from 'next-intl'
const t = useTranslations('common')
<Button>{t('save')}</Button>
```

---

## 18. Error Boundaries

- **Page-level**: `app/error.tsx` (Next.js convention).
- **Component-level**: react-error-boundary untuk heavy components (Map, Timeline) — fallback graceful.
- **Sentry** capture client errors di production.

---

## 19. Sumber Tech yang Dipilih

Cross-reference: `docs/REFERENCES.md`. Setiap library punya justifikasi (mengapa dipilih vs alternatif).
