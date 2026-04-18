"use client"

import { useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Target, LogOut, User, LayoutDashboard, List } from "lucide-react"
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
import { SavedLists } from "@/components/dashboard/SavedLists"
import toast from "react-hot-toast"
import type { BusinessFilters } from "@/types"

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [scrapeModalOpen, setScrapeModalOpen] = useState(false)
  const [currentView, setCurrentView] = useState<"main" | "lists" | "list_detail">("main")
  const [selectedList, setSelectedList] = useState<{ id: string; name: string } | null>(null)

  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 20
  const sortBy = searchParams.get("sortBy") || "created_at"
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc"

  const filters: BusinessFilters = {
    city: searchParams.get("city") || undefined,
    district: searchParams.get("district") || undefined,
    neighborhood: searchParams.get("neighborhood") || undefined,
    category: searchParams.get("category") || undefined,
    hasEmail: searchParams.get("hasEmail") === "true" ? true : undefined,
    hasWebsite: searchParams.get("hasWebsite") === "true" ? true : undefined,
    hasPhone: searchParams.get("hasPhone") === "true" ? true : undefined,
    minRating: searchParams.get("minRating") ? Number(searchParams.get("minRating")) : undefined,
    minReviews: searchParams.get("minReviews") ? Number(searchParams.get("minReviews")) : undefined,
    sortBy,
    sortOrder,
    page,
    limit,
  }

  const { data, isLoading } = useBusinesses(filters)

  const updateQueryParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(key, value)
      router.push(`/dashboard?${params.toString()}`, { scroll: false })
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
      router.push(`/dashboard?${params.toString()}`, { scroll: false })
    },
    [searchParams, router]
  )

  const handleSort = useCallback(
    (field: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (sortBy === field) {
        params.set("sortOrder", sortOrder === "asc" ? "desc" : "asc")
      } else {
        params.set("sortBy", field)
        params.set("sortOrder", "desc")
      }
      router.push(`/dashboard?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, sortBy, sortOrder]
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
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 shadow-lg shadow-blue-500/5">
              <Target className="size-5 text-blue-400 rotate-12 transition-transform group-hover:rotate-0" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white italic uppercase bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              LeadSpin
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
      <main className="mx-auto max-w-[1800px] px-6 py-6 md:px-8">
        {/* Top Header Section: Navigation + Stats */}
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between">
          {/* Vertical Navigation Column */}
          <div className="flex w-full flex-col gap-1.5 rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-2 backdrop-blur-sm lg:w-[240px] shrink-0">
            <Button
              variant="ghost"
              onClick={() => setCurrentView("main")}
              className={cn(
                "justify-start h-11 px-4 rounded-xl font-medium transition-colors",
                currentView === "main" ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <LayoutDashboard className="mr-3 size-5" />
              Tüm Leads
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCurrentView("lists")}
              className={cn(
                "justify-start h-11 px-4 rounded-xl font-medium transition-colors",
                currentView === "lists" ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              )}
            >
              <List className="mr-3 size-5" />
              Listeler
            </Button>
            <div className="my-1 h-px bg-zinc-800/50" />
            <Button
              onClick={() => setScrapeModalOpen(true)}
              className="justify-start bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 h-11 px-4 rounded-xl font-semibold transition-all duration-300 active:scale-95"
            >
              <Target className="mr-3 size-5" />
              Yeni Tarama Başlat
            </Button>
          </div>

          {/* Compact Stats Bar on the Right */}
          <div className="flex-1">
            <StatsBar />
          </div>
        </div>

        <div className="flex flex-col gap-6 xl:flex-row">
          {/* Sidebar */}
          <div className="flex w-full flex-col gap-6 xl:w-[300px] shrink-0">
            <FilterBar onOpenScrapeModal={() => setScrapeModalOpen(true)} />
            <ScrapeHistory />
          </div>

          {/* Table Area */}
          <div className="flex-1 min-w-0">
            <LeadTable
              data={data}
              isLoading={isLoading}
              page={page}
              limit={limit}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              onSort={handleSort}
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
