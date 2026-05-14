import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'

import { AntiFlashScript } from '@/components/theme/anti-flash-script'
import { FontLoader } from '@/components/theme/font-loader'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { QueryProvider } from '@/components/providers/query-provider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Atsar — Jejak generasi terbaik, dalam genggamanmu.',
    template: '%s · Atsar',
  },
  description:
    'Aplikasi sirah para Nabi, Sahabat, dan ulama salaf — dengan timeline, peta interaktif, dan AI deep research bersumber salaf.',
  applicationName: 'Atsar',
}

// `viewport` was missing → Android Chrome / Safari iOS rendered the page at
// its "natural" desktop width and let users pinch-zoom out, producing the
// "tampilan aneh saat zoom out di mobile" report. Set device-width + 1x
// initial scale; cap at 5x so accessibility users can still zoom in but
// pinch-zoom-out collapsing the layout is disabled.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Anti-flash theme script — must run BEFORE CSS / hydration so we
            never render a wrong-theme first paint. */}
        <AntiFlashScript />
        {/* Dynamic font manifest (Google Fonts <link> + :root CSS vars).
            Async server component; gracefully no-ops if the DB is down. */}
        <FontLoader />
      </head>
      <body className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--text))] antialiased">
        <ThemeProvider>
          <QueryProvider>{children}</QueryProvider>
          <Toaster
            position="top-right"
            theme="system"
            richColors
            closeButton
            toastOptions={{ classNames: { toast: 'athar-toast' } }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
