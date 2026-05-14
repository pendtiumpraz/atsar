import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // ── Dangerous → error (block commit) ────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // rules-of-hooks stays error (always-correct check).
      // exhaustive-deps stays warn because there are 5+ pre-existing
      // violations in admin tables that need a useMemo wrap; bumping
      // to error blocks the whole Vercel build until those land.
      // Revisit once those are fixed.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Wrong promise handling — biggest source of silent prod bugs.
      // Enabled where supported by Next's TS preset; otherwise no-op.
      'no-undef': 'off', // TS already enforces this; ESLint double-check is noisy.

      // ── Style / loose typing → warn (don't block, but visible) ──────
      // We deliberately use `any` in the API client typing layer.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      'react/no-unescaped-entities': 'warn',
      '@next/next/no-img-element': 'warn',
    },
  },
]

export default config
