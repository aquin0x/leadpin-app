"use client"

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback } from "react"
import { Search, X, ScanSearch, Trash2 } from "lucide-react"
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

  const city = searchParams.get("city") || ""
  const category = searchParams.get("category") || ""
  const hasEmail = searchParams.get("hasEmail") === "true"
  const hasWebsite = searchParams.get("hasWebsite") === "true"

  const updateParams = useCallback(
    (key: string, value: string | boolean | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === null || value === "" || value === false) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [router, pathname])

  const hasActiveFilters = city || category || hasEmail || hasWebsite

  return (
    <aside className="flex w-full flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur-sm lg:w-[260px]">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
        <Search className="size-4 text-zinc-500" />
        Filtreler
      </h3>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="filter-city" className="text-sm text-zinc-400">
            Şehir
          </Label>
          <Input
            id="filter-city"
            placeholder="İstanbul, Ankara..."
            value={city}
            onChange={(e) => updateParams("city", e.target.value)}
            className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-category" className="text-sm text-zinc-400">
            Kategori
          </Label>
          <Input
            id="filter-category"
            placeholder="Restoran, kuaför..."
            value={category}
            onChange={(e) => updateParams("category", e.target.value)}
            className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="filter-email" className="text-sm text-zinc-400">
            E-posta var
          </Label>
          <Switch
            id="filter-email"
            checked={hasEmail}
            onCheckedChange={(checked) => updateParams("hasEmail", checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="filter-website" className="text-sm text-zinc-400">
            Web sitesi var
          </Label>
          <Switch
            id="filter-website"
            checked={hasWebsite}
            onCheckedChange={(checked) => updateParams("hasWebsite", checked)}
          />
        </div>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="w-full text-zinc-400 hover:text-zinc-200"
        >
          <X className="mr-1 size-3.5" />
          Filtreleri Temizle
        </Button>
      )}

      <Separator className="bg-zinc-800" />

      <div className="space-y-2">
        <Button
          onClick={handleClearData}
          variant="outline"
          className="w-full border-red-900/50 bg-red-900/10 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
        >
          <Trash2 className="mr-2 size-4" />
          Verileri Sıfırla
        </Button>

        <Button
          onClick={onOpenScrapeModal}
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
        >
          <ScanSearch className="mr-2 size-4" />
          Yeni Tarama Başlat
        </Button>
      </div>
    </aside>
  )
}
