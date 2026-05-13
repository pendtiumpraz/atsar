// Placeholder landing page. Full hero design in Phase 9.
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <p
        className="text-7xl"
        style={{ fontFamily: 'var(--font-display-arab)', color: 'rgb(var(--primary))' }}
        dir="rtl"
        lang="ar"
      >
        أثر
      </p>
      <h1
        className="mt-2 text-4xl font-bold"
        style={{ fontFamily: 'var(--font-display-latin)' }}
      >
        ATHAR
      </h1>
      <p className="mt-6 max-w-xl text-lg" style={{ color: 'rgb(var(--text-muted))' }}>
        Jejak generasi terbaik, dalam genggamanmu.
      </p>
      <p
        className="mt-2 max-w-xl text-base"
        style={{ color: 'rgb(var(--text-muted))', fontFamily: 'var(--font-body-arab)' }}
        dir="rtl"
        lang="ar"
      >
        آثار خير القرون بين يديك
      </p>
      <p className="mt-12 text-sm" style={{ color: 'rgb(var(--text-faint))' }}>
        Phase 0 ✓ Phase 1+ coming.
      </p>
    </main>
  )
}
