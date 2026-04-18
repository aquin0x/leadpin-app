"use client"

import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BusinessInfoCard } from "@/components/business/BusinessInfoCard"
import { ContactSection } from "@/components/business/ContactSection"
import { OutreachPanel } from "@/components/business/OutreachPanel"
import { OutreachHistory } from "@/components/business/OutreachHistory"
import { useBusiness } from "@/hooks/useBusiness"

export default function BusinessDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: business, isLoading, error } = useBusiness(id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
            <Skeleton className="h-8 w-8 rounded-lg bg-zinc-800" />
            <Skeleton className="h-6 w-48 bg-zinc-800" />
          </div>
        </header>
        <main className="mx-auto max-w-4xl space-y-6 p-4">
          <Skeleton className="h-64 rounded-xl bg-zinc-900" />
          <Skeleton className="h-48 rounded-xl bg-zinc-900" />
          <Skeleton className="h-80 rounded-xl bg-zinc-900" />
        </main>
      </div>
    )
  }

  if (error || !business) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950">
        <p className="text-lg text-zinc-400">İşletme bulunamadı</p>
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mt-4 text-zinc-400"
        >
          <ArrowLeft className="mr-2 size-4" />
          Dashboard&apos;a Dön
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10">
            <Target className="size-3.5 text-blue-400" />
          </div>
          <h1 className="truncate text-sm font-semibold text-zinc-300">
            {business.name}
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl space-y-6 p-4 pt-6">
        <BusinessInfoCard business={business} />
        <OutreachPanel business={business} />
        <OutreachHistory logs={business.outreach_logs || []} />
      </main>
    </div>
  )
}
