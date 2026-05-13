import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Monorepo: transpile workspace packages.
  transpilePackages: [
    '@athar/db',
    '@athar/ai',
    '@athar/ui',
    '@athar/shared',
    '@athar/hijri',
  ],

  experimental: {
    typedRoutes: true,
  },

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Whitelist domains untuk citation source preview (kelak).
      { protocol: 'https', hostname: '**.upstash.io' },
    ],
  },

  // Allow .js extension in relative imports to resolve to .ts source files.
  // Required because our tsconfig uses Node-ESM-style explicit `.js` imports,
  // but webpack/turbopack don't auto-resolve `.js` → `.ts` by default.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return config
  },

  turbopack: {
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.mts'],
    resolveAlias: {
      // Help turbopack mirror webpack's extension aliasing.
    },
  },
}

export default config
