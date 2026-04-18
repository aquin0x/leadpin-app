"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Globe,
  Mail,
  MessageCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPhone, formatRating } from "@/lib/utils"
import { generateMessages } from "@/lib/message-generator"
import { useWhatsAppOutreach } from "@/hooks/useOutreach"
import type { Business, PaginatedBusinesses } from "@/types"
import toast from "react-hot-toast"

interface LeadTableProps {
  data: PaginatedBusinesses | undefined
  isLoading: boolean
  page: number
  limit: number
  sortBy: string
  sortOrder: "asc" | "desc"
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onSort: (field: string) => void
}

function WhatsAppPopover({ business }: { business: Business }) {
  const [selectedMsg, setSelectedMsg] = useState("0")
  const [open, setOpen] = useState(false)
  const outreach = useWhatsAppOutreach()
  const messages = generateMessages(business)

  const handleSend = () => {
    const message = messages[parseInt(selectedMsg)]
    outreach.mutate(
      { businessId: business.id, message },
      {
        onSuccess: () => {
          toast.success("WhatsApp açılıyor...")
          setOpen(false)
        },
        onError: () => {
          toast.error("Bir hata oluştu")
        },
      }
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-[min(var(--radius-md),10px)] bg-emerald-600/20 px-2 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-600/30"
      >
        <MessageCircle className="mr-1 size-3" />
        WA
      </PopoverTrigger>
      <PopoverContent
        className="w-96 border-zinc-700 bg-zinc-900 p-4"
        align="end"
      >
        <h4 className="mb-3 text-sm font-semibold text-zinc-200">
          Mesaj Seçin
        </h4>
        <RadioGroup value={selectedMsg} onValueChange={setSelectedMsg}>
          {messages.map((msg, i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-lg border border-zinc-700/50 p-3 transition-colors hover:border-zinc-600 has-data-[state=checked]:border-emerald-600/50 has-data-[state=checked]:bg-emerald-600/5"
            >
              <RadioGroupItem value={String(i)} id={`msg-${business.id}-${i}`} className="mt-0.5" />
              <Label
                htmlFor={`msg-${business.id}-${i}`}
                className="cursor-pointer text-xs leading-relaxed text-zinc-300"
              >
                {msg}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <Button
          onClick={handleSend}
          disabled={outreach.isPending}
          className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-500"
          size="sm"
        >
          <MessageCircle className="mr-2 size-3.5" />
          {outreach.isPending ? "Gönderiliyor..." : "WhatsApp'ta Aç"}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

export function LeadTable({
  data,
  isLoading,
  page,
  limit,
  sortBy,
  sortOrder,
  onPageChange,
  onLimitChange,
  onSort,
}: LeadTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-12 w-full rounded-lg bg-zinc-800/50"
          />
        ))}
      </div>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 py-20">
        <div className="mb-4 rounded-full bg-zinc-800 p-4">
          <Globe className="size-8 text-zinc-500" />
        </div>
        <p className="text-lg font-medium text-zinc-300">
          Henüz işletme bulunamadı
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Yeni bir tarama başlatarak işletmeleri keşfedin
        </p>
      </div>
    )
  }

  const startIndex = (page - 1) * limit + 1
  const endIndex = Math.min(page * limit, data.total)

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <div className="ml-1 size-3 opacity-20" />
    return sortOrder === "asc" ? (
      <ChevronRight className="-rotate-90 ml-1 size-3 text-emerald-400" />
    ) : (
      <ChevronRight className="rotate-90 ml-1 size-3 text-emerald-400" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-sm overflow-x-auto">
        <Table className="table-fixed min-w-[1200px] w-full">
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead 
                className="w-[200px] text-zinc-400 cursor-pointer hover:text-zinc-200"
                onClick={() => onSort("name")}
              >
                <div className="flex items-center">İşletme Adı <SortIcon field="name" /></div>
              </TableHead>
              <TableHead 
                className="w-[140px] text-zinc-400 cursor-pointer hover:text-zinc-200"
                onClick={() => onSort("category")}
              >
                <div className="flex items-center">Kategori <SortIcon field="category" /></div>
              </TableHead>
              <TableHead className="w-[100px] text-zinc-400">Şehir</TableHead>
              <TableHead className="w-[120px] text-zinc-400">İlçe</TableHead>
              <TableHead className="w-[140px] text-zinc-400">Mahalle</TableHead>
              <TableHead className="w-[140px] text-zinc-400">Telefon</TableHead>
              <TableHead className="w-[60px] text-zinc-400 text-center">Web</TableHead>
              <TableHead className="w-[60px] text-zinc-400 text-center">E-posta</TableHead>
              <TableHead 
                className="w-[85px] text-zinc-400 text-center cursor-pointer hover:text-zinc-200"
                onClick={() => onSort("rating")}
              >
                <div className="flex items-center justify-center">Puan <SortIcon field="rating" /></div>
              </TableHead>
              <TableHead 
                className="w-[85px] text-zinc-400 text-center cursor-pointer hover:text-zinc-200"
                onClick={() => onSort("reviews_count")}
              >
                <div className="flex items-center justify-center">Yorum <SortIcon field="reviews_count" /></div>
              </TableHead>
              <TableHead className="w-[120px] text-zinc-400 text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((business) => {
              const hasEmail = business.contacts?.some((c) => c.email)
              const hasWebsite = !!business.website
              
              return (
                <TableRow
                  key={business.id}
                  className="border-zinc-800/50 transition-colors duration-150 hover:bg-zinc-800/30"
                >
                  <TableCell className="truncate">
                    <Link
                      href={`/businesses/${business.id}`}
                      className="font-semibold text-zinc-100 hover:text-emerald-400 transition-colors block truncate"
                      title={business.name}
                    >
                      {business.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-zinc-400 truncate" title={business.category}>
                    <span className="block truncate">{business.category}</span>
                  </TableCell>
                  <TableCell className="text-zinc-300 truncate">{business.city}</TableCell>
                  <TableCell className="text-zinc-300 truncate">{business.district || "—"}</TableCell>
                  <TableCell className="text-zinc-300 truncate">{business.neighborhood || "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-zinc-300">
                    {formatPhone(business.phone)}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasWebsite ? (
                      <Globe className="mx-auto size-4 text-emerald-400" />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasEmail ? (
                      <Mail className="mx-auto size-4 text-emerald-400" />
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-medium text-zinc-200">{business.rating || "0.0"}</span>
                      <span className="text-yellow-500/80 text-[10px]">★</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-zinc-400">
                    {business.reviews_count ? business.reviews_count.toLocaleString('tr-TR') : '0'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <WhatsAppPopover business={business} />
                      <Link href={`/businesses/${business.id}`}>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                        >
                          <ExternalLink className="size-3.5 text-zinc-400" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          {startIndex} - {endIndex} / <span className="font-medium text-zinc-300">{data.total}</span> sonuç
        </p>

        <div className="flex items-center gap-3">
          <Select
            value={String(limit)}
            onValueChange={(val) => {
              if (val) onLimitChange(Number(val))
            }}
          >
            <SelectTrigger className="w-20 border-zinc-700 bg-zinc-800/50 text-zinc-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-zinc-700 bg-zinc-900">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="border-zinc-700 bg-zinc-800/50"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= (data.totalPages || 1)}
              className="border-zinc-700 bg-zinc-800/50"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
