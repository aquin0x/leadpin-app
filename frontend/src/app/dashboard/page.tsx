"use client"

import { useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { MapPin, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatsBar } from "@/components/dashboard/StatsBar"
import { FilterBar } from "@/components/dashboard/FilterBar"
import { ScrapeHistory } from "@/components/dashboard/ScrapeHistory"
import { LeadTable } from "@/components/dashboard/LeadTable"
import { ScrapeModal } from "@/components/dashboard/ScrapeModal"
import { useBusinesses } from "@/hooks/useBusinesses"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { createClient } from "@/lib/supabase-client"
import toast from "react-hot-toast"
import type { BusinessFilters } from "@/types"

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false)

  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 20

  const filters: BusinessFilters = {
    city: searchParams.get("city") || undefined,
    category: searchParams.get("category") || undefined,
    hasEmail: searchParams.get("hasEmail") === "true" ? true : undefined,
    hasWebsite: searchParams.get("hasWebsite") === "true" ? true : undefined,
    page,
    limit,
  }

  const { data, isLoading } = useBusinesses(filters)

  const updateQueryParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      router.push(`/dashboard?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handlePageChange = useCallback(
    (newPage: number) => updateQueryParam("page", String(newPage)),
    [updateQueryParam]
  )

  const handleLimitChange = useCallback(
    (newLimit: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("limit", String(newLimit))
      params.delete("page")
      router.push(`/dashboard?${params.toString()}`)
    },
    [searchParams, router]
  )

  const handleScrapeComplete = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.businesses.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.scrapeJobs.all })
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Çıkış yapıldı")
    router.push("/auth")
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <MapPin className="size-4 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-100">
              Maps Lead Engine
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-zinc-200"
            >
              <User className="mr-1 size-3.5" />
              Hesap
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-zinc-400 hover:text-red-400"
            >
              <LogOut className="mr-1 size-3.5" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl p-4">
        <div className="mb-6">
          <StatsBar />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex w-full flex-col gap-6 lg:w-[280px]">
            <FilterBar onOpenScrapeModal={() => setScrapeModalOpen(true)} />
            <ScrapeHistory />
          </div>

          <div className="flex-1">
            <LeadTable
              data={data}
              isLoading={isLoading}
              page={page}
              limit={limit}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          </div>
        </div>
      </main>

      <ScrapeModal
        open={scrapeModalOpen}
        onOpenChange={setScrapeModalOpen}
        onComplete={handleScrapeComplete}
      />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-900" />
          ))}
        </div>
        <div className="flex gap-6">
          <div className="hidden h-96 w-64 animate-pulse rounded-xl bg-zinc-900 lg:block" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-900" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
