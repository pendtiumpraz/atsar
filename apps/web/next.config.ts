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
}

export default config
