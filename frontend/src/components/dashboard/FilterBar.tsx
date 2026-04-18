"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback } from "react"
import { Search, X, ScanSearch, Trash2, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { clearAllData } from "@/lib/api-client"
import toast from "react-hot-toast"

interface FilterBarProps {
  onOpenScrapeModal: () => void
  onRefresh?: () => void
}

export function FilterBar({ onOpenScrapeModal, onRefresh }: FilterBarProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Local state for filters to avoid triggering on every keystroke
  const [localFilters, setLocalFilters] = useState({
    city: searchParams.get("city") || "",
    district: searchParams.get("district") || "",
    neighborhood: searchParams.get("neighborhood") || "",
    category: searchParams.get("category") || "",
    hasEmail: searchParams.get("hasEmail") === "true",
    hasWebsite: searchParams.get("hasWebsite") === "true",
    hasPhone: searchParams.get("hasPhone") === "true",
    minRating: searchParams.get("minRating") || "",
    minReviews: searchParams.get("minReviews") || "",
  })

  // Sync with URL when URL changes (e.g. from clear filters or back button)
  useEffect(() => {
    setLocalFilters({
      city: searchParams.get("city") || "",
      district: searchParams.get("district") || "",
      neighborhood: searchParams.get("neighborhood") || "",
      category: searchParams.get("category") || "",
      hasEmail: searchParams.get("hasEmail") === "true",
      hasWebsite: searchParams.get("hasWebsite") === "true",
      hasPhone: searchParams.get("hasPhone") === "true",
      minRating: searchParams.get("minRating") || "",
      minReviews: searchParams.get("minReviews") || "",
    })
  }, [searchParams])

  const handleApplyFilters = useCallback(() => {
    const params = new URLSearchParams()
    
    // Preserve pagination if needed, or reset to 1 (usually best when filtering)
    // params.set("page", "1")

    Object.entries(localFilters).forEach(([key, value]) => {
      if (value !== "" && value !== false && value !== null) {
        params.set(key, String(value))
      }
    })

    router.push(`${pathname}?${params.toString()}`)
    toast.success("Filtreler uygulandı", { duration: 1500, icon: '🔍' })
  }, [localFilters, router, pathname])

  const handleClearData = async () => {
    if (!confirm("Tüm tarama verilerini, işletmeleri ve logları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
      return
    }

    try {
      await clearAllData()
      toast.success("Tüm veriler temizlendi")
      if (onRefresh) onRefresh()
      router.refresh()
    } catch {
      toast.error("Veriler temizlenirken bir hata oluştu")
    }
  }

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const hasChanges = 
    localFilters.city !== (searchParams.get("city") || "") ||
    localFilters.district !== (searchParams.get("district") || "") ||
    localFilters.neighborhood !== (searchParams.get("neighborhood") || "") ||
    localFilters.category !== (searchParams.get("category") || "") ||
    localFilters.hasEmail !== (searchParams.get("hasEmail") === "true") ||
    localFilters.hasWebsite !== (searchParams.get("hasWebsite") === "true") ||
    localFilters.hasPhone !== (searchParams.get("hasPhone") === "true") ||
    localFilters.minRating !== (searchParams.get("minRating") || "") ||
    localFilters.minReviews !== (searchParams.get("minReviews") || "")

  const hasActiveFilters = 
    searchParams.get("city") || 
    searchParams.get("district") || 
    searchParams.get("neighborhood") || 
    searchParams.get("category") || 
    searchParams.get("hasEmail") === "true" || 
    searchParams.get("hasWebsite") === "true" || 
    searchParams.get("hasPhone") === "true" || 
    searchParams.get("minRating") || 
    searchParams.get("minReviews")

  return (
    <aside className="flex w-full flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm xl:w-[320px]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          <Search className="size-4 text-zinc-500" />
          Filtreler
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors uppercase font-bold"
          >
            Temizle
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="filter-city" className="text-xs text-zinc-500 font-bold uppercase">
              Şehir
            </Label>
            <Input
              id="filter-city"
              placeholder="İstanbul..."
              value={localFilters.city}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, city: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="filter-district" className="text-xs text-zinc-500 font-bold uppercase">
              İlçe
            </Label>
            <Input
              id="filter-district"
              placeholder="Maltepe..."
              value={localFilters.district}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, district: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-hood" className="text-xs text-zinc-500 font-bold uppercase">
            Mahalle
          </Label>
          <Input
            id="filter-hood"
            placeholder="Altayçeşme..."
            value={localFilters.neighborhood}
            onChange={(e) => setLocalFilters(prev => ({ ...prev, neighborhood: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-category" className="text-xs text-zinc-500 font-bold uppercase">
            Kategori
          </Label>
          <Input
            id="filter-category"
            placeholder="Kafe, Restoran..."
            value={localFilters.category}
            onChange={(e) => setLocalFilters(prev => ({ ...prev, category: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="filter-min-rating" className="text-xs text-zinc-500 font-bold uppercase">
              Min. Puan
            </Label>
            <Input
              id="filter-min-rating"
              type="number"
              step="0.1"
              placeholder="0.0"
              value={localFilters.minRating}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, minRating: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-min-reviews" className="text-xs text-zinc-500 font-bold uppercase">
              Min. Yorum
            </Label>
            <Input
              id="filter-min-reviews"
              type="number"
              placeholder="0"
              value={localFilters.minReviews}
              onChange={(e) => setLocalFilters(prev => ({ ...prev, minReviews: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="h-9 border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <Separator className="bg-zinc-800/50" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="filter-email" className="text-sm text-zinc-400">
              E-posta Var
            </Label>
            <Switch
              id="filter-email"
              checked={localFilters.hasEmail}
              onCheckedChange={(checked) => setLocalFilters(prev => ({ ...prev, hasEmail: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="filter-website" className="text-sm text-zinc-400">
              Web Sitesi Var
            </Label>
            <Switch
              id="filter-website"
              checked={localFilters.hasWebsite}
              onCheckedChange={(checked) => setLocalFilters(prev => ({ ...prev, hasWebsite: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="filter-phone" className="text-sm text-zinc-400">
              Telefon Var
            </Label>
            <Switch
              id="filter-phone"
              checked={localFilters.hasPhone}
              onCheckedChange={(checked) => setLocalFilters(prev => ({ ...prev, hasPhone: checked }))}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <Button
          onClick={handleApplyFilters}
          disabled={!hasChanges}
          className={cn(
            "w-full transition-all duration-300",
            hasChanges 
              ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20" 
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          )}
        >
          <Filter className="mr-2 size-4" />
          Filtreleri Uygula
        </Button>

        <Separator className="bg-zinc-800" />

        <div className="grid grid-cols-1 gap-2">
          <Button
            onClick={onOpenScrapeModal}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
          >
            <ScanSearch className="mr-2 size-4" />
            Yeni Tarama Başlat
          </Button>

          <Button
            onClick={handleClearData}
            variant="ghost"
            className="w-full text-zinc-500 hover:text-red-400 hover:bg-red-400/5 transition-colors"
          >
            <Trash2 className="mr-2 size-3.5" />
            Verileri Sıfırla
          </Button>
        </div>
      </div>
    </aside>
  )
}
