import { getSeedDb, logSeed } from './_helpers.js'
import { permissions } from '../schema/index.js'

// Permission slugs per BACKEND.md §5.4.
const PERMS: Array<{ slug: string; group: string; nameId: string }> = [
  // Figures
  { slug: 'figures.view', group: 'figures', nameId: 'Lihat tokoh' },
  { slug: 'figures.create', group: 'figures', nameId: 'Tambah tokoh' },
  { slug: 'figures.update', group: 'figures', nameId: 'Edit tokoh' },
  { slug: 'figures.delete', group: 'figures', nameId: 'Hapus tokoh (soft)' },
  { slug: 'figures.publish', group: 'figures', nameId: 'Publish tokoh' },
  { slug: 'figures.review', group: 'figures', nameId: 'Review tokoh' },
  // Battles
  { slug: 'battles.view', group: 'battles', nameId: 'Lihat sirah perang' },
  { slug: 'battles.create', group: 'battles', nameId: 'Tambah sirah perang' },
  { slug: 'battles.update', group: 'battles', nameId: 'Edit sirah perang' },
  { slug: 'battles.delete', group: 'battles', nameId: 'Hapus sirah perang' },
  { slug: 'battles.publish', group: 'battles', nameId: 'Publish sirah perang' },
  // Trash
  { slug: 'trash.view', group: 'trash', nameId: 'Lihat trash' },
  { slug: 'trash.restore', group: 'trash', nameId: 'Restore item' },
  { slug: 'trash.hard_delete', group: 'trash', nameId: 'Hapus permanen' },
  // AI
  { slug: 'ai.chat', group: 'ai', nameId: 'AI chat' },
  { slug: 'ai.agent.use', group: 'ai', nameId: 'AI agent (deep research)' },
  { slug: 'ai.doc_analyzer.use', group: 'ai', nameId: 'AI doc analyzer' },
  { slug: 'ai_providers.manage', group: 'ai', nameId: 'Manage AI providers' },
  { slug: 'ai_models.manage', group: 'ai', nameId: 'Manage AI models' },
  // Users
  { slug: 'users.view', group: 'users', nameId: 'Lihat users' },
  { slug: 'users.invite', group: 'users', nameId: 'Undang user/ustadz' },
  { slug: 'users.update', group: 'users', nameId: 'Edit user' },
  { slug: 'users.delete', group: 'users', nameId: 'Hapus user' },
  { slug: 'users.set_role', group: 'users', nameId: 'Set role user' },
  // Roles & menus
  { slug: 'roles.manage', group: 'roles', nameId: 'Manage roles & permissions' },
  { slug: 'permissions.manage', group: 'roles', nameId: 'Manage permissions' },
  { slug: 'menu.manage', group: 'roles', nameId: 'Manage menu matrix' },
  // Subscriptions
  { slug: 'subscriptions.view', group: 'subscriptions', nameId: 'Lihat subscriptions' },
  { slug: 'subscriptions.activate', group: 'subscriptions', nameId: 'Aktifkan lisensi' },
  { slug: 'payments.confirm', group: 'subscriptions', nameId: 'Konfirmasi pembayaran' },
  // Fonts
  { slug: 'fonts.view', group: 'fonts', nameId: 'Lihat font' },
  { slug: 'fonts.manage', group: 'fonts', nameId: 'Add/edit/upload font' },
  { slug: 'fonts.activate', group: 'fonts', nameId: 'Aktifkan font per role' },
  // Whitelist
  { slug: 'whitelist.manage', group: 'whitelist', nameId: 'Manage whitelist domain' },
  // PDF
  { slug: 'pdf.export', group: 'pdf', nameId: 'Export PDF' },
  { slug: 'pdf.export_custom', group: 'pdf', nameId: 'Custom nama/email di PDF' },
  // Quiz
  { slug: 'quiz.attempt', group: 'quiz', nameId: 'Ikut quiz' },
  { slug: 'quiz.manage', group: 'quiz', nameId: 'Manage quiz' },
  // Audit
  { slug: 'audit_log.view', group: 'audit', nameId: 'Lihat audit log' },
  // Security
  { slug: 'security.manage', group: 'security', nameId: 'Manage security settings' },
]

export async function seed002Permissions() {
  const db = getSeedDb()
  const data = PERMS.map((p) => ({ ...p, isSystem: true }))
  const result = await db.insert(permissions).values(data).onConflictDoNothing().returning()
  logSeed('permissions', result.length)
}
