// Auth & RBAC schema. See DATABASE.md §2.

import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  primaryKey,
  inet,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './_common.js'
import { localeEnum, themePreferenceEnum, calendarPreferenceEnum } from './enums.js'

// ─── users ─────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    ...baseColumns,
    email: text('email').notNull().unique(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    // Better-auth expects a boolean `emailVerified` field; keep
    // `emailVerifiedAt` (timestamp) alongside for audit purposes.
    emailVerified: boolean('email_verified').notNull().default(false),
    passwordHash: text('password_hash'), // argon2id (legacy; better-auth uses accounts.password)
    fullName: text('full_name').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    locale: localeEnum('locale').default('id').notNull(),
    themePreference: themePreferenceEnum('theme_preference').default('auto').notNull(),
    calendarPreference: calendarPreferenceEnum('calendar_preference').default('both').notNull(),
    fontPreferenceId: uuid('font_preference_id'),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('users_email_active_idx').on(t.email).where(sql`${t.deletedAt} IS NULL`),
    index('users_active_idx').on(t.id).where(sql`${t.deletedAt} IS NULL`),
  ],
)

// ─── roles ─────────────────────────────────────────────────────────
export const roles = pgTable(
  'roles',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(), // 'admin' | 'reviewer' | 'subscriber'
    nameId: text('name_id').notNull(),
    nameAr: text('name_ar'),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
  },
  (t) => [uniqueIndex('roles_slug_active_idx').on(t.slug).where(sql`${t.deletedAt} IS NULL`)],
)

// ─── user_roles (M2M) ──────────────────────────────────────────────
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid('assigned_by'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.roleId] }),
    index('user_roles_user_idx').on(t.userId),
    index('user_roles_role_idx').on(t.roleId),
  ],
)

// ─── permissions ───────────────────────────────────────────────────
export const permissions = pgTable(
  'permissions',
  {
    ...baseColumns,
    slug: text('slug').notNull().unique(), // 'figures.create', 'users.invite', ...
    group: text('group').notNull(),
    nameId: text('name_id').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(false),
  },
  (t) => [
    uniqueIndex('permissions_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('permissions_group_idx').on(t.group),
  ],
)

// ─── role_permissions (M2M) ────────────────────────────────────────
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid('granted_by'),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index('role_permissions_role_idx').on(t.roleId),
  ],
)

// ─── menu_items ────────────────────────────────────────────────────
export const menuItems = pgTable(
  'menu_items',
  {
    ...baseColumns,
    parentId: uuid('parent_id'),
    slug: text('slug').notNull(),
    labelId: text('label_id').notNull(),
    labelAr: text('label_ar'),
    icon: text('icon'),
    path: text('path'),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    requiredPermission: text('required_permission'),
  },
  (t) => [
    uniqueIndex('menu_items_slug_active_idx')
      .on(t.slug)
      .where(sql`${t.deletedAt} IS NULL`),
    index('menu_items_parent_idx').on(t.parentId),
  ],
)

// ─── role_menu_access ──────────────────────────────────────────────
export const roleMenuAccess = pgTable(
  'role_menu_access',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    menuItemId: uuid('menu_item_id')
      .notNull()
      .references(() => menuItems.id, { onDelete: 'cascade' }),
    canView: boolean('can_view').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.menuItemId] })],
)

// ─── sessions ──────────────────────────────────────────────────────
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    // Better-auth expects an `updatedAt` column on sessions for session refresh.
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
)

// ─── accounts ──────────────────────────────────────────────────────
// Better-auth credential / OAuth storage. One row per (provider, account).
// For email/password the row carries the hashed password; for OAuth it
// holds the provider tokens. Keeping this as a separate table allows a
// single user to link multiple providers.
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(), // 'email' | google sub | ...
    providerId: text('provider_id').notNull(), // 'credential' | 'google' | 'magic-link'
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'), // better-auth hashes via its bcrypt
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accounts_user_idx').on(t.userId),
    uniqueIndex('accounts_provider_account_idx').on(t.providerId, t.accountId),
  ],
)

// ─── verifications ─────────────────────────────────────────────────
// Better-auth's generic verification token store (email verification,
// magic links, password reset). Kept in parallel with our existing
// `email_verification_tokens` / `password_reset_tokens` tables — those
// remain authoritative for legacy code paths; this is what better-auth's
// adapter looks for by default.
export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(), // email or magic-link token
    value: text('value').notNull(), // the verification value
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

// ─── password_reset_tokens ─────────────────────────────────────────
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── email_verification_tokens ─────────────────────────────────────
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── reviewer_profiles ─────────────────────────────────────────────
export const reviewerProfiles = pgTable('reviewer_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  bioId: text('bio_id'),
  bioAr: text('bio_ar'),
  specialty: text('specialty').array(),
  institutions: text('institutions').array(),
  isActive: boolean('is_active').notNull().default(true),
  invitedBy: uuid('invited_by'),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
