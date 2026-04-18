import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <Skeleton className="h-8 w-48 bg-zinc-800" />
          <Skeleton className="h-8 w-24 bg-zinc-800" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-zinc-900" />
          ))}
        </div>

        {/* Content skeleton */}
        <div className="flex gap-6">
          <Skeleton className="hidden h-96 w-64 rounded-xl bg-zinc-900 lg:block" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg bg-zinc-900" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
