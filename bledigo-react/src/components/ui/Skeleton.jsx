/**
 * Skeleton loaders — used while API data is loading.
 * Matches the visual shape of the real content so the layout
 * doesn't jump when data arrives.
 */

export function SkeletonLine({ width = 'w-full', height = 'h-4' }) {
  return (
    <div
      className={`${width} ${height} rounded bg-gradient-to-r from-border via-border-2/30 to-border bg-[length:200%_100%] animate-[shimmer_1.4s_ease_infinite]`}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-border rounded-card p-5 flex flex-col gap-3">
      <SkeletonLine width="w-2/3" height="h-5" />
      <SkeletonLine width="w-full" height="h-3" />
      <SkeletonLine width="w-4/5" height="h-3" />
      <div className="flex gap-2 mt-2">
        <SkeletonLine width="w-16" height="h-6" />
        <SkeletonLine width="w-20" height="h-6" />
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 4, cols = 5 }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-border bg-surface-2">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width="flex-1" height="h-3" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-4 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width="flex-1" height="h-3" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div className={`grid grid-cols-${count} gap-3.5 mb-5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-border rounded-card p-5 flex flex-col gap-3">
          <SkeletonLine width="w-10" height="h-10" />
          <SkeletonLine width="w-1/2" height="h-7" />
          <SkeletonLine width="w-3/4" height="h-3" />
        </div>
      ))}
    </div>
  )
}

/** Full-page centered spinner */
export function PageLoader({ message = 'Chargement…' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-t3">
      <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#EEF1F8" strokeWidth="3" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#1A3C6B" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-[13px]">{message}</span>
    </div>
  )
}
