import { Skeleton } from "@/components/ui/skeleton"

export default function BusinessDetailLoading() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Skeleton className="h-7 w-7 rounded-lg bg-zinc-800" />
          <Skeleton className="h-5 w-48 bg-zinc-800" />
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 p-4 pt-6">
        <Skeleton className="h-72 rounded-xl bg-zinc-900" />
        <Skeleton className="h-48 rounded-xl bg-zinc-900" />
        <Skeleton className="h-80 rounded-xl bg-zinc-900" />
        <Skeleton className="h-48 rounded-xl bg-zinc-900" />
      </main>
    </div>
  )
}
