"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Download, Loader2, List as ListIcon } from "lucide-react"
import * as XLSX from "xlsx"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { LeadTable } from "./LeadTable"
import type { Business, PaginatedBusinesses } from "@/types"
import toast from "react-hot-toast"

interface ListDetailProps {
  listId: string
  listName: string
  onBack: () => void
}

interface ListWithBusinesses {
  id: string
  name: string
  created_at: string
  businesses: Business[]
}

export function ListDetail({ listId, listName, onBack }: ListDetailProps) {
  const [list, setList] = useState<ListWithBusinesses | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sortBy, setSortBy] = useState("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const data = await api.get<ListWithBusinesses>(`/api/lists/${listId}`)
        if (!cancelled) setList(data)
      } catch {
        if (!cancelled) toast.error("Liste yüklenemedi")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [listId])

  const sortedBusinesses = useMemo(() => {
    if (!list?.businesses) return []
    const arr = [...list.businesses]
    arr.sort((a, b) => {
      const av = (a as any)[sortBy]
      const bv = (b as any)[sortBy]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "number" && typeof bv === "number") {
        return sortOrder === "asc" ? av - bv : bv - av
      }
      return sortOrder === "asc"
        ? String(av).localeCompare(String(bv), "tr")
        : String(bv).localeCompare(String(av), "tr")
    })
    return arr
  }, [list, sortBy, sortOrder])

  const pagedData: PaginatedBusinesses | undefined = useMemo(() => {
    if (!list) return undefined
    const total = sortedBusinesses.length
    const start = (page - 1) * limit
    return {
      data: sortedBusinesses.slice(start, start + limit),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  }, [list, sortedBusinesses, page, limit])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(o => o === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const handleExport = () => {
    if (!list?.businesses?.length) {
      toast.error("Listede işletme yok")
      return
    }
    const rows = list.businesses.map(b => ({
      "İşletme Adı": b.name ?? "",
      "Kategori": b.category ?? "",
      "Şehir": b.city ?? "",
      "İlçe": b.district ?? "",
      "Mahalle": b.neighborhood ?? "",
      "Adres": b.address ?? "",
      "Telefon": b.phone ?? "",
      "Web Sitesi": b.website ?? "",
      "Puan": b.rating ?? "",
      "Yorum Sayısı": b.reviews_count ?? "",
      "Google Maps": b.google_maps_url ?? "",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const colWidths = Object.keys(rows[0]).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String((r as any)[key] ?? "").length)) + 2
    }))
    ws["!cols"] = colWidths
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Leads")
    const safeName = list.name.replace(/[\\/:*?"<>|]/g, "_")
    XLSX.writeFile(wb, `${safeName}.xlsx`)
    toast.success("Excel dosyası indirildi")
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="mr-1 size-4" />
            Geri
          </Button>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 shadow-lg shadow-blue-500/5">
            <ListIcon className="size-6 text-blue-400" />
          </div>
          <div>
            <h2 className="font-sans text-2xl font-bold tracking-tight text-white">
              {listName}
            </h2>
            <p className="text-sm text-zinc-500">
              {isLoading ? "Yükleniyor..." : `${list?.businesses?.length ?? 0} işletme`}
            </p>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={isLoading || !list?.businesses?.length}
          className="bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-900/20"
        >
          <Download className="mr-2 size-4" />
          Excel Olarak İndir
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-[400px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <LeadTable
          data={pagedData}
          isLoading={false}
          page={page}
          limit={limit}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1) }}
          onSort={handleSort}
        />
      )}
    </div>
  )
}
