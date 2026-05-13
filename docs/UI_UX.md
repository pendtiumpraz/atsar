# Athar — UI/UX Design System

> Pelengkap BRANDING.md (palette, typography) dan WIREFRAMES.md (layout per fitur). Doc ini fokus ke **design tokens, atomic component spec, dan interaksi**.

---

## 1. Prinsip Desain

1. **Substansi dulu, dekorasi kedua** — konten sirah adalah utama; UI harus mempermudah baca, bukan menghias.
2. **Bilingual-first** — Arab dan Indonesia diperlakukan setara, layout RTL bekerja sempurna.
3. **Aksesibilitas WCAG AA** — wajib untuk semua interactive components.
4. **Konsistensi via tokens** — tidak ada hardcoded color, spacing, font size.
5. **Atomic Design** — komponen bisa dirangkai bertahap.
6. **Anti-flash** — theme switch, font load, calendar mode toggle harus halus.
7. **Adab visual** — tidak ada wajah manusia, ornamen sesuai etika.

---

## 2. Design Tokens (CSS Custom Properties)

Cross-reference: BRANDING §4 (light) & §4b (dark).

### 2.1 Spacing Scale (4px base)
```
--space-0:   0
--space-0.5: 2px
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
--space-20:  80px
```

### 2.2 Border Radius
```
--radius-none:  0
--radius-sm:    4px       (input, badge)
--radius-md:    8px       (button, card)
--radius-lg:    12px      (modal, dropdown)
--radius-xl:    16px      (hero card)
--radius-2xl:   24px
--radius-full:  9999px    (avatar, chip)
```

### 2.3 Shadows
```
--shadow-xs:  0 1px 2px rgba(0,0,0,0.04)
--shadow-sm:  0 1px 3px rgba(0,0,0,0.06)
--shadow-md:  0 4px 6px rgba(0,0,0,0.08)
--shadow-lg:  0 10px 25px rgba(0,0,0,0.10)
--shadow-xl:  0 20px 50px rgba(0,0,0,0.12)

/* Dark mode: shadows are stronger but warm-tinted */
[data-theme="dark"] {
  --shadow-md: 0 4px 12px rgba(0,0,0,0.30);
  --shadow-lg: 0 16px 32px rgba(0,0,0,0.40);
}
```

### 2.4 Motion Tokens
```
--ease-out:        cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out:     cubic-bezier(0.65, 0, 0.35, 1)
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1)

--duration-instant:  100ms
--duration-fast:     150ms
--duration-base:     200ms
--duration-slow:     300ms
--duration-slower:   500ms

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }
}
```

### 2.5 Typography Scale
```
--text-xs:    12px / 1.5
--text-sm:    13px / 1.5
--text-base:  16px / 1.6           (body Latin)
--text-base-ar: 18px / 1.8         (body Arabic — slightly larger)
--text-lg:    18px / 1.6
--text-xl:    20px / 1.5
--text-2xl:   24px / 1.4
--text-3xl:   30px / 1.3
--text-4xl:   36px / 1.25
--text-5xl:   48px / 1.2
--text-6xl:   60px / 1.15
--text-7xl:   72px / 1.1
```

### 2.6 Z-Index Layers
```
--z-base:     0
--z-dropdown: 100
--z-sticky:   200
--z-overlay:  300
--z-modal:    400
--z-popover:  500
--z-toast:    600
--z-tooltip:  700
--z-max:      9999
```

---

## 3. Atomic Components — Spec

### 3.1 Button

```
┌──────────────────────────────┐
│  Primary                     │
│  ┌─────────────┐             │
│  │  Simpan     │  emerald bg │
│  └─────────────┘             │
│                              │
│  Secondary (outline)         │
│  ┌─────────────┐             │
│  │  Batal       │  border    │
│  └─────────────┘             │
│                              │
│  Ghost                       │
│  Tindakan minor              │
│                              │
│  Destructive                 │
│  ┌─────────────┐             │
│  │  Hapus      │  danger    │
│  └─────────────┘             │
└──────────────────────────────┘
```

**Variants**: `primary | secondary | outline | ghost | danger | success`
**Sizes**: `xs (28px) | sm (32px) | md (40px) | lg (48px) | xl (56px)`
**States**: default, hover, active, focus (ring 2px accent), disabled, loading (spinner)

**Props**:
- `iconLeft`, `iconRight`
- `loading` (replace icon with spinner, disable click)
- `fullWidth`
- `as` ("a" | "button" | Link)

### 3.2 Input

```
Label                          (Inter SemiBold 13px)
┌───────────────────────────┐
│ Placeholder              │  border 1px, radius-sm
└───────────────────────────┘
Helper text                    (text-muted)
```

Variants: `text | email | password | search | number`
Sizes: `sm | md | lg`
States: error (red border + error message below)

### 3.3 Badge / Chip / Tag

```
Badge:  ┌──────────┐    ┌──────────┐    ┌──────────┐
        │ Sahabat  │    │ Anshar   │    │ Tsiqah   │
        └──────────┘    └──────────┘    └──────────┘
        (subtle bg, no border, rounded-full)

Chip (interactive):  same with × to remove
Tag (clickable):     same with hover state
```

### 3.4 Avatar

- Sizes: xs 24, sm 32, md 40, lg 56, xl 96
- Tidak menampilkan foto tokoh (adab). Untuk user: foto OK.
- Untuk tokoh: gunakan **inisial** dalam lingkaran kaligrafi (mis. أبو bekr = "أب").
- Pakai SVG generator (lihat IDEAS §5b.5).

### 3.5 Modal (via SweetAlert2 styled)

```
┌──────────────────────────────────────┐
│              Title                    │
│                                       │
│  Body content goes here.              │
│                                       │
│  [ Konfirmasi ]   [ Batal ]           │
└──────────────────────────────────────┘
```

Tokens: bg surface, radius-lg, shadow-xl, max-width 480px, backdrop blur.

### 3.6 Toast (Sonner)

```
┌────────────────────────────┐
│ ✓ Berhasil disimpan       ✕│
│ "Tokoh X telah dibuat"      │
└────────────────────────────┘
position: top-right
auto-dismiss 4s (except errors: 8s)
```

Variants: success, error, info, warning, loading.

### 3.7 Card

```
┌────────────────────────────┐
│ Header (optional)          │
│ ───                         │
│ Body content                │
│ ───                         │
│ Footer (optional)           │
└────────────────────────────┘
```

Tokens: bg surface, radius-md, shadow-sm hover→shadow-md, border 1px.

### 3.8 Table (TanStack Table)

```
┌──────────────────────────────────────────────────┐
│ Header (sticky)                  search 🔍         │
├──┬────────┬──────────┬─────────┬─────────┬───────┤
│☐ │ Nama   │ Kategori │ Wafat   │ Status  │ Aksi  │
├──┼────────┼──────────┼─────────┼─────────┼───────┤
│☐ │ ...    │ ...      │ ...     │ ...     │ ⋯     │
└──┴────────┴──────────┴─────────┴─────────┴───────┘
[ Bulk action ▾ ]                pagination ◀ 1 2 3 ▶
```

Features: sortable, filterable, selectable (bulk), expandable rows, virtualized.

### 3.9 Tabs

```
[Active] [Inactive] [Inactive]
   ───────
   underline accent
```

ARIA-compliant, keyboard arrow navigation.

### 3.10 Switch

```
○ ─────              ────● 
   off                  on (accent)
```

Animated transition 200ms.

---

## 4. Sidebar Component Spec

User instruction: **1 warna icon**.

### Expanded (240px)
```
┌──────────────────────────┐
│  [logo أ ث ر ATHAR]      │  (header, padding-y 6)
├──────────────────────────┤
│  📊  Dashboard           │  (item padding-x 4, py 3, gap 3)
│  👥  Tokoh           ▾   │  (active state: subtle bg + accent text)
│      ↪ Nabi              │  (nested: indent left 8)
│      ↪ Sahabat           │
│  ⏱  Timeline             │
│  🗺  Peta                │
│  ⚔  Perang               │
│  📚  Quiz                │
│  🤖  AI Chat             │
│  📄  PDF Builder         │
│  ────                    │  (divider)
│  ⚙  Settings             │
│  💳  Billing             │
├──────────────────────────┤
│  [< Tutup]               │  (collapse trigger)
└──────────────────────────┘
```

### Collapsed (64px)
```
┌──┐
│أ ث│  (mini logo)
├──┤
│📊│
│👥│
│⏱│
│🗺│
│⚔│
│📚│
│🤖│
│📄│
│──│
│⚙│
│💳│
├──┤
│>│
└──┘
```

Hover icon (collapsed) → tooltip muncul kanan dengan label.

### Tokens
```css
.sidebar {
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  width: 240px;
  transition: width var(--duration-base) var(--ease-in-out);
}
.sidebar[data-collapsed="true"] { width: 64px; }

.sidebar-link {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--text);
  border-radius: var(--radius-md);
  transition: background var(--duration-fast);
}
.sidebar-link:hover { background: var(--bg-elevated); }
.sidebar-link[aria-current="page"] {
  background: var(--bg-elevated);
  color: var(--accent);
}

.sidebar-icon {
  color: var(--sidebar-icon);     /* 1 WARNA konsisten */
  stroke-width: 1.75;
}
.sidebar-link[aria-current="page"] .sidebar-icon {
  color: var(--accent);            /* hanya active state */
}
```

### Mobile (≤768px)
Drawer slide dari kiri, overlay backdrop blur. Trigger: hamburger menu di navbar kiri.

---

## 5. Navbar Component Spec

```
┌────────────────────────────────────────────────────────────┐
│  ☰ Tokoh > Sahabat > Abu Bakr      ✨ 1,234  📥 47/100  🔔3 │
│  (breadcrumb, left)                  (right cluster)         │
│                                       🌙  ⊕H   👤            │
└────────────────────────────────────────────────────────────┘
```

### Right Cluster Items (kanan ke kiri)

1. **User Menu** (👤) — Dropdown: Profile, Billing, Theme, Logout.
2. **Calendar Toggle** (⊕H/M/Both) — Trinary toggle dengan badge state.
3. **Theme Toggle** (🌙/☀/⚙) — 3-state dropdown.
4. **Notification Bell** (🔔) — Badge unread count. Dropdown 10 terakhir + link "Lihat semua".
5. **Quota Indicator** (📥) — Mini progress: "47/100" PDF. Hover: AI chat juga.
6. **AI Credit Chip** (✨) — Format: ✨ 1,234. Hover tooltip:
   ```
   Bulan ini: 12 chat, 4 PDF
   Reset: 7 Jun 2026
   [Lihat detail →]
   ```

### Behavior
- Sticky top (`position: sticky; top: 0; z-index: var(--z-sticky)`).
- Background backdrop-blur saat scroll.
- Height 56px fixed.

---

## 6. Arabic Typography — Readability Priorities

User instruction: **font Arab benar-benar terbaca**.

### 6.1 Pilihan Font (Priority Order)
| Use Case | Font Utama | Fallback |
|---|---|---|
| Logo & big headlines | Amiri (Naskh klasik) | Scheherazade |
| Section headers | Reem Kufi (Kufi modern) | Cairo Bold |
| Body Arabic | Cairo (Sans Arabic modern) | Tajawal, Noto Sans Arabic |
| Quran & hadits | Amiri (line-height extra) | Lateef, Scheherazade New |
| Mono Arabic (jarang) | IBM Plex Sans Arabic | Noto Sans Arabic |

### 6.2 Aturan Spesifik Arab
```css
[lang="ar"], [dir="rtl"] {
  /* Arabic butuh line-height lebih, font-size lebih besar dari Latin */
  font-family: var(--font-body-arab);
  font-size: 1.125rem;           /* 18px vs 16px Latin */
  line-height: 1.8;
  letter-spacing: 0;             /* JANGAN letter-spacing untuk Arab — merusak ligature */
  text-align: right;
}

/* Quran style */
.quran-text {
  font-family: var(--font-quran-arab);
  font-size: 1.5rem;             /* 24px */
  line-height: 2.4;
  text-align: center;
  direction: rtl;
}

/* Hadith style */
.hadith-text {
  font-family: var(--font-quran-arab);
  font-size: 1.25rem;
  line-height: 2.2;
  text-align: right;
  direction: rtl;
  padding: var(--space-4);
  border-right: 4px solid var(--accent);
  background: var(--bg-elevated);
}
```

### 6.3 Hindari
- ❌ Letter-spacing pada Arabic.
- ❌ Italic style untuk Arab (tidak ada di script).
- ❌ All caps untuk Arab.
- ❌ Font Latin yang punya Arabic glyph buruk (Inter default Arab tidak bagus).
- ❌ Font weight di bawah 400 untuk Arab body (terlalu tipis, sulit baca).
- ❌ Justify pada paragraf Arab pendek (gap besar antar kata).

### 6.4 Test Wajib Setiap Font Arab Baru
- Tampilkan kaligrafi `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ` — harus harakat akurat.
- Tampilkan nama tokoh: `عُمَر بن الخطّاب` — kasrah, fathah, tasydid jelas.
- Tampilkan tanpa harakat: `أبو بكر الصديق` — ligature kuat.
- Test di **light dan dark mode** — kontras tetap baik.

---

## 7. Dual-Language Layout Patterns

### 7.1 Stacked (default untuk biografi panjang)
```
أبو بكر الصديق رضي الله عنه
        (Arabic, dir=rtl)
Abu Bakr ash-Shiddiq RA
        (Latin)
```

### 7.2 Side-by-Side (untuk header & metadata)
```
┌─────────────────┬─────────────────┐
│ أبو بكر          │ Abu Bakr        │
│ الصديق           │ ash-Shiddiq RA  │
│ (dir=rtl)        │                 │
└─────────────────┴─────────────────┘
```

### 7.3 Inline (untuk nama dalam paragraf)
```
"Said bin al-Musayyab (سعيد بن المسيب) adalah salah satu..."

Inline Arab pakai font-family override di span:
<span lang="ar" className="font-body-arab">سعيد بن المسيب</span>
```

### 7.4 Quranic Quote
```
┌────────────────────────────────────────┐
│ ﴿وَالسَّابِقُونَ الْأَوَّلُونَ مِنَ الْمُهَاجِرِينَ﴾ │
│       (Quranic style, centered, big)   │
│                                        │
│ "Dan orang-orang yang terdahulu        │
│  pertama-tama dari kalangan Muhajirin..." │
│       (Indonesian italic, smaller)     │
│                                        │
│ — QS. At-Taubah: 100                    │
└────────────────────────────────────────┘
```

---

## 8. Color Application Rules

### Light Mode
- Primary action: Emerald `#0F4C3A` — button utama, link.
- Background: Cream `#FAF5EB`.
- Surface elevated: Cream-2 `#F2EBD9`.
- Accent: Gold `#B89968` — badge, highlight, decorative.
- Text body: Espresso `#1F1810`.
- Text muted: `#6B5E4D`.
- Border: `#E8DFC8`.

### Dark Mode
- Primary action: Emerald Bright `#4ABC95`.
- Background: Night Ink `#0F0D0A`.
- Surface: Espresso `#1F1810`.
- Accent: Gold Warm `#D4B783`.
- Text body: Cream `#FAF5EB`.
- Text muted: `#C9BFAB`.
- Border: `#2A2218`.

### Usage Rules
- **Gold** maksimal 5–10% area visual.
- **Emerald** untuk primary action saja, tidak besar.
- **Background gradient** OPSIONAL hanya di hero, sangat halus.
- **Tidak ada pure white #FFF atau pure black #000** — selalu warm-tinted.

---

## 9. Component Density Modes

Three density modes user bisa pilih (settings):
- **Comfortable** (default) — padding generous, ideal reading.
- **Compact** — padding 70%, untuk data-heavy admin.
- **Cozy** — middle ground.

Implementasi via CSS variable `--density-multiplier`:
```css
[data-density="compact"] { --density-multiplier: 0.7; }
[data-density="cozy"]    { --density-multiplier: 0.85; }
[data-density="comfort"] { --density-multiplier: 1; }

.card { padding: calc(var(--space-6) * var(--density-multiplier)); }
```

Default: Subscriber/Reviewer = Comfortable, Admin panel = Cozy.

---

## 10. Empty States

```
┌─────────────────────────────────┐
│                                 │
│         (illustration)          │
│      ornamen geometris           │
│                                 │
│    Belum ada data di sini       │
│                                 │
│    Coba ubah filter atau tambah │
│    item baru                    │
│                                 │
│    [Aksi Utama]                 │
└─────────────────────────────────┘
```

Setiap empty state punya:
- Illustration (SVG ornament, bukan emoji generic).
- Heading singkat.
- Helper text + CTA.

---

## 11. Loading States

### Skeleton
Untuk RSC pages, sediakan `loading.tsx` dengan skeleton match layout.

### Spinner Inline
Untuk button action, ganti icon dengan spinner.

### Page Loader
Untuk transisi route, NextJS auto-show progress bar (via `nextjs-toploader`).

---

## 12. Form UX

- **Label di atas input** (bukan placeholder-only).
- **Error message** di bawah input, ikon merah, text-sm.
- **Required indicator** = asterisk merah setelah label.
- **Submit disabled** sampai semua required terisi & valid.
- **Inline validation** on blur, bukan on every keystroke.
- **Success state** subtle (border emerald, jangan ikon centang gigantic).

---

## 13. Confirmation Patterns

### Soft Confirm (SweetAlert2)
```
Hapus tokoh "Abu Bakr"?
[Batal]  [Ya, hapus]
```

### Hard Confirm (untuk destructive)
```
Hapus PERMANEN "Abu Bakr"?
Tindakan ini TIDAK BISA dibatalkan.
Ketik "HAPUS" untuk konfirmasi:
[__________]
[Batal]  [Hapus Permanen]
```

### Bulk Confirm
```
Hapus 12 tokoh terpilih?
[Batal]  [Hapus Semua]
```

---

## 14. Notification Hierarchy

1. **Toast (Sonner)** — feedback singkat 4s. "Tersimpan", "Gagal".
2. **Inline alert** — di dalam form / page. "Validasi gagal", "Kuota habis".
3. **Notification panel** — riwayat persistent (PDF siap, review selesai).
4. **Banner top** — sistem-wide (subscription habis, maintenance window).
5. **Modal SweetAlert** — konfirmasi destruktif.

---

## 15. Microinteractions

- **Button click**: scale 0.97 100ms.
- **Card hover**: translateY -2px + shadow up.
- **Theme switch**: cross-fade 200ms.
- **Modal enter**: scale 0.95 → 1 + opacity 0 → 1, 200ms ease-out.
- **Toast enter**: slide from right 250ms.
- **Sidebar collapse**: width transition 250ms.
- **Tab change**: underline slide 150ms.
- **Skeleton shimmer**: gradient 1.5s loop.

---

## 16. Responsive Strategy

### Breakpoints (Tailwind default)
```
sm:  640px    Mobile landscape, small tablet
md:  768px    Tablet portrait
lg:  1024px   Desktop, app split-pane active
xl:  1280px   Wide desktop
2xl: 1536px   Very wide
```

### Mobile-First Approach
- Default styles untuk mobile.
- `md:` prefix untuk tablet.
- `lg:` untuk desktop.

### Critical Breakpoints per Komponen
- **Sidebar**: drawer < lg, expanded > lg.
- **Side-by-side CRUD**: stack < lg, split > lg.
- **Map**: full bleed mobile, side-panel desktop.
- **Timeline**: horizontal scroll mobile, full viewport desktop.

---

## 17. Atomic Design — Folder Mapping

```
components/
├── atoms/               # Button, Input, Badge, ...
├── molecules/           # FormField, BackButton, ...
├── organisms/           # Sidebar, Navbar, DataTable, ...
├── templates/           # ListDetailShell, DashboardShell, ...
└── (pages = app routes)
```

### Naming Convention
- Atoms: noun, `Button.tsx`, `Input.tsx`.
- Molecules: composite, `SearchBox.tsx`, `FormField.tsx`.
- Organisms: feature, `Sidebar.tsx`, `FigureCard.tsx`.
- Templates: shell, `ListDetailShell.tsx`.

### Composition Rule
- Atoms tidak boleh import dari Molecules/Organisms.
- Molecules tidak boleh import dari Organisms.
- Tidak ada circular import.

---

## 18. Accessibility Pattern Library

### Keyboard Navigation Targets
- All buttons reachable via Tab.
- All Dropdown via Tab + Enter + Arrow keys.
- Modal: focus trap dalam modal, Esc untuk tutup.
- Skip links untuk main content & navigation.

### ARIA Roles Umum
```html
<button aria-label="Hapus tokoh Abu Bakr" aria-busy={loading}>
<dialog role="dialog" aria-labelledby="dialog-title" aria-modal="true">
<nav aria-label="Main navigation">
<main aria-label="Konten utama">
<section aria-labelledby="biografi-heading">
```

### Screen Reader Labels untuk Bilingual
```html
<p lang="ar" dir="rtl">أبو بكر</p>
<p lang="id">Abu Bakr</p>
```

---

## 19. Dark Mode Special Cases

- **Logo**: switch ke gold/cream variant otomatis.
- **Map tile**: switch ke dark tile (MapLibre dark style).
- **Chart**: re-color via tokens, jangan hardcode.
- **PDF preview iframe**: tetap light (PDF selalu light).
- **Email**: tetap light.
- **External widget iframe** (review source): respect site sendiri, jangan force inject.

---

## 20. Iconography

- Library: **Lucide React** (open source, mature).
- Stroke width: 1.75 (default), 2 untuk small (16px).
- Size: 16, 20, 24, 32, 48.
- 1 warna konsisten via `color: currentColor`.
- Active state: ganti warna ke accent.
- Custom icons via SVG component bila Lucide tidak ada (mis. ikon mushaf, ka'bah simbolik).

---

## 21. Brand Voice Reminder

(Dari BRANDING.md §7 — pasang di sini untuk quick ref design)

- Lugas, hormat, tidak hyperbolic.
- Selalu pakai shalawat ﷺ untuk Nabi, RA untuk sahabat, rahimahullah untuk ulama.
- Tidak ada emoji di copy resmi (Sidebar/Navbar OK pakai icon, bukan emoji).
- Citation transparan — "menurut kitab X" bukan "konon".

---

## 22. Checklist Komponen Baru

Tiap kali buat atom/molecule/organism baru:
- [ ] TypeScript prop interface jelas.
- [ ] Variants & sizes documented.
- [ ] Light + dark mode kerja.
- [ ] RTL layout kerja (bila relevan untuk konten Arab).
- [ ] Keyboard accessible (Tab, Enter, Esc, Arrow).
- [ ] ARIA labels lengkap.
- [ ] Loading & error states.
- [ ] Test snapshot di Storybook (opsional v2).
- [ ] Tidak ada inline style (semua via tokens / Tailwind classes).
