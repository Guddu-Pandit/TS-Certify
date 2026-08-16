export default function AdminLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="space-y-2">
        <div className="h-6 w-40 animate-pulse rounded bg-black/8" />
        <div className="h-4 w-64 animate-pulse rounded bg-black/5" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-18.5 animate-pulse rounded-xl bg-black/8" />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="h-11 border-b border-line bg-brand-soft/40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-3 py-4 last:border-0">
            <div className="h-4 w-4 animate-pulse rounded bg-black/8" />
            <div className="h-4 flex-1 animate-pulse rounded bg-black/5" />
            <div className="h-4 w-48 animate-pulse rounded bg-black/5" />
            <div className="h-4 w-32 animate-pulse rounded bg-black/5" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-black/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
