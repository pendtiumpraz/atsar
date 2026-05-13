import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Athar — Jejak generasi terbaik, dalam genggamanmu.',
    template: '%s · Athar',
  },
  description:
    'Aplikasi sirah para Nabi, Sahabat, dan ulama salaf — dengan timeline, peta interaktif, dan AI deep research bersumber salaf.',
  applicationName: 'Athar',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        {/* Anti-flash theme script — sets data-theme before CSS loads. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function() {
              try {
                var stored = localStorage.getItem('theme') || 'auto';
                var isDark = stored === 'dark' || (stored === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
              } catch (e) {}
            })();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
