// Suspense fallback for any page under `(app)`. Pure presentational —
// shows a grid of card skeletons with the brand pulse animation defined
// in `globals.css` (falls back to Tailwind `animate-pulse` otherwise).
//
// Next.js renders this automatically when a server component below this
// layout suspends. Keep it lightweight — no client JS, no data fetching.

export default function AppLoading() {
  return (
    <div
      className="flex w-full flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Memuat…</span>

      {/* Page header skeleton */}
      <div className="space-y-3">
        <div className="h-7 w-48 animate-pulse rounded-md bg-[rgb(var(--bg-elevated))]" />
        <div className="h-4 w-72 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
      </div>

      {/* Toolbar skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-10 w-64 animate-pulse rounded-md bg-[rgb(var(--bg-elevated))]" />
        <div className="h-10 w-24 animate-pulse rounded-md bg-[rgb(var(--bg-elevated))]" />
      </div>

      {/* Content grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="aspect-[4/3] w-full animate-pulse bg-[rgb(var(--bg-elevated))]" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
        <div className="h-3 w-full animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
      </div>
    </div>
  )
}
