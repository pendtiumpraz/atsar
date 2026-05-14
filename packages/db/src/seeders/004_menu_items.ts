import { getSeedDb, logSeed } from './_helpers.js'
import { menuItems } from '../schema/index.js'

// Menu structure per FRONTEND.md §3 + UI_UX.md §4.
type MenuSeed = {
  slug: string
  labelId: string
  labelAr?: string
  icon?: string
  path?: string
  displayOrder: number
  requiredPermission?: string
  /** Defaults to true. Set false for hidden / archived menu entries. */
  isActive?: boolean
  children?: MenuSeed[]
}

const MENU: MenuSeed[] = [
  {
    slug: 'dashboard',
    labelId: 'Dashboard',
    icon: 'LayoutDashboard',
    path: '/dashboard',
    displayOrder: 10,
  },
  {
    slug: 'figures',
    labelId: 'Tokoh',
    icon: 'Users',
    path: '/figures',
    displayOrder: 20,
    requiredPermission: 'figures.view',
    children: [
      { slug: 'figures-nabi', labelId: 'Para Nabi', icon: 'BookOpen', path: '/figures?cat=nabi', displayOrder: 1 },
      { slug: 'figures-sahabat', labelId: 'Sahabat', icon: 'User', path: '/figures?cat=sahabat&g=male', displayOrder: 2 },
      { slug: 'figures-shahabiyat', labelId: 'Shahabiyat', icon: 'User', path: '/figures?cat=sahabat&g=female', displayOrder: 3 },
      { slug: 'figures-tabiin', labelId: "Tabi'in", icon: 'User', path: '/figures?cat=tabiin&g=male', displayOrder: 4 },
      { slug: 'figures-tabiiyat', labelId: "Tabi'iyyat", icon: 'User', path: '/figures?cat=tabiin&g=female', displayOrder: 5 },
      { slug: 'figures-tabiut', labelId: "Tabi'ut Tabi'in", icon: 'User', path: '/figures?cat=tabiut_tabiin&g=male', displayOrder: 6 },
      { slug: 'figures-tabiut-fem', labelId: "Tabi'at Tabi'iyyat", icon: 'User', path: '/figures?cat=tabiut_tabiin&g=female', displayOrder: 7 },
      { slug: 'figures-shalih', labelId: 'Shalih & Shalihah', icon: 'BookHeart', path: '/figures?cat=shalih', displayOrder: 8 },
    ],
  },
  { slug: 'timeline', labelId: 'Timeline', icon: 'Clock', path: '/timeline', displayOrder: 30 },
  { slug: 'timeline-ulama', labelId: 'Timeline Ulama Salaf', icon: 'GitBranch', path: '/timeline-ulama', displayOrder: 35 },
  { slug: 'map', labelId: 'Peta', icon: 'Map', path: '/map', displayOrder: 40 },
  { slug: 'battles', labelId: 'Sirah Perang', icon: 'Swords', path: '/battles', displayOrder: 50, requiredPermission: 'battles.view' },
  { slug: 'quiz', labelId: 'Quiz', icon: 'GraduationCap', path: '/quiz', displayOrder: 60, requiredPermission: 'quiz.attempt' },
  { slug: 'chat', labelId: 'AI Chat', icon: 'Sparkles', path: '/chat', displayOrder: 70, requiredPermission: 'ai.chat' },
  { slug: 'pdf-builder', labelId: 'PDF Builder', icon: 'FileText', path: '/pdf-builder', displayOrder: 80, requiredPermission: 'pdf.export' },
  // ─── Reviewer area ────────────────────────────────────────
  { slug: 'reviewer-queue', labelId: 'Review Queue', icon: 'ClipboardList', path: '/queue', displayOrder: 100, requiredPermission: 'figures.review' },
  // ─── Admin area ───────────────────────────────────────────
  // Order: dashboard → ops (users, roles, menus) → infra (ai, fonts) → data
  // (locations) → billing (payments, subs, whitelist) → audit / trash.
  { slug: 'admin-dashboard', labelId: 'Admin Dashboard', icon: 'LayoutDashboard', path: '/admin/dashboard', displayOrder: 195 },
  { slug: 'admin-users', labelId: 'Users', icon: 'UsersRound', path: '/admin/users', displayOrder: 200, requiredPermission: 'users.view' },
  { slug: 'admin-roles', labelId: 'Roles & Menu', icon: 'Shield', path: '/admin/roles', displayOrder: 210, requiredPermission: 'roles.manage' },
  { slug: 'admin-menus', labelId: 'Menus', icon: 'ListTree', path: '/admin/menus', displayOrder: 215, requiredPermission: 'roles.manage' },
  { slug: 'admin-ai', labelId: 'AI Providers', icon: 'Bot', path: '/admin/ai-providers', displayOrder: 220, requiredPermission: 'ai_providers.manage' },
  { slug: 'admin-fonts', labelId: 'Fonts', icon: 'Type', path: '/admin/fonts', displayOrder: 230, requiredPermission: 'fonts.manage' },
  { slug: 'admin-locations', labelId: 'Lokasi', icon: 'MapPin', path: '/admin/locations', displayOrder: 235 },
  { slug: 'admin-whitelist', labelId: 'Whitelist Domain', icon: 'Globe', path: '/admin/whitelist', displayOrder: 240, requiredPermission: 'whitelist.manage' },
  { slug: 'admin-payments', labelId: 'Pembayaran', icon: 'Wallet', path: '/admin/payments', displayOrder: 245, requiredPermission: 'subscriptions.view' },
  { slug: 'admin-subs', labelId: 'Subscriptions', icon: 'CreditCard', path: '/admin/subscriptions', displayOrder: 250, requiredPermission: 'subscriptions.view' },
  { slug: 'admin-audit', labelId: 'Audit Log', icon: 'ScrollText', path: '/admin/audit-logs', displayOrder: 260, requiredPermission: 'audit_log.view' },
  // "Trash" entries are intentionally inactive — the figures-trash UI now
  // lives as an admin-only "Sampah" pill inside <FigureCategoryTabs> on
  // /figures. Battles-trash is accessed from /battles in the same way once
  // that tab UI lands. Rows kept so admins can re-enable from the menu
  // admin if they want them back in the sidebar.
  {
    slug: 'admin-trash',
    labelId: 'Trash',
    icon: 'Trash2',
    path: '/admin/trash',
    displayOrder: 270,
    requiredPermission: 'trash.view',
    isActive: false,
    children: [
      { slug: 'admin-trash-figures', labelId: 'Sampah Tokoh', icon: 'Trash2', path: '/admin/trash/figures', displayOrder: 1, isActive: false },
      { slug: 'admin-trash-battles', labelId: 'Sampah Peristiwa', icon: 'Trash2', path: '/admin/trash/battles', displayOrder: 2, isActive: false },
    ],
  },
  // ─── Settings ─────────────────────────────────────────────
  { slug: 'settings', labelId: 'Settings', icon: 'Settings', path: '/settings', displayOrder: 900 },
  { slug: 'billing', labelId: 'Billing', icon: 'Wallet', path: '/billing', displayOrder: 910 },
]

export async function seed004MenuItems() {
  const db = getSeedDb()
  let total = 0
  for (const parent of MENU) {
    const [inserted] = await db
      .insert(menuItems)
      .values({
        slug: parent.slug,
        labelId: parent.labelId,
        labelAr: parent.labelAr,
        icon: parent.icon,
        path: parent.path,
        displayOrder: parent.displayOrder,
        requiredPermission: parent.requiredPermission,
        isActive: parent.isActive ?? true,
      })
      .onConflictDoNothing()
      .returning()
    if (inserted) total++
    if (parent.children) {
      const parentRow = inserted ?? (await db.query.menuItems.findFirst({ where: (m, { eq }) => eq(m.slug, parent.slug) }))
      if (parentRow) {
        for (const child of parent.children) {
          const [c] = await db
            .insert(menuItems)
            .values({
              parentId: parentRow.id,
              slug: child.slug,
              labelId: child.labelId,
              labelAr: child.labelAr,
              icon: child.icon,
              path: child.path,
              displayOrder: child.displayOrder,
              requiredPermission: child.requiredPermission,
              isActive: child.isActive ?? true,
            })
            .onConflictDoNothing()
            .returning()
          if (c) total++
        }
      }
    }
  }
  logSeed('menu_items', total)
}
