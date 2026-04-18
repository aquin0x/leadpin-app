"use client"

import { useState, useEffect } from "react"
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "./StatusBadge"
import { startScrape } from "@/lib/api-client"
import { useScrapeJob } from "@/hooks/useScrapeJob"
import toast from "react-hot-toast"

interface ScrapeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export function ScrapeModal({ open, onOpenChange, onComplete }: ScrapeModalProps) {
  const [provinces, setProvinces] = useState<any[]>([])
  const [districts, setDistricts] = useState<any[]>([])
  const [neighborhoods, setNeighborhoods] = useState<any[]>([])
  
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(false)
  const [isLoadingDistricts, setIsLoadingDistricts] = useState(false)
  const [isLoadingNeighborhoods, setIsLoadingNeighborhoods] = useState(false)

  const [category, setCategory] = useState("")
  const [city, setCity] = useState("")
  const [district, setDistrict] = useState("")
  const [neighborhood, setNeighborhood] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { job } = useScrapeJob(jobId)

  // Fetch all provinces on mount
  useEffect(() => {
    if (!open) return
    setIsLoadingProvinces(true)
    fetch("https://turkiyeapi.dev/api/v1/provinces")
      .then(res => res.json())
      .then(res => setProvinces(res.data || []))
      .catch(() => toast.error("Şehirler yüklenirken hata oluştu"))
      .finally(() => setIsLoadingProvinces(false))
  }, [open])

  const handleCityChange = (val: string) => {
    setCity(val)
    setDistrict("")
    setNeighborhood("")
    setDistricts([])
    setNeighborhoods([])

    const province = provinces.find(p => p.name === val)
    if (province) {
      setIsLoadingDistricts(true)
      fetch(`https://turkiyeapi.dev/api/v1/provinces/${province.id}`)
        .then(res => res.json())
        .then(res => setDistricts(res.data.districts || []))
        .finally(() => setIsLoadingDistricts(false))
    }
  }

  const handleDistrictChange = (val: string) => {
    setDistrict(val)
    setNeighborhood("")
    setNeighborhoods([])

    const dist = districts.find(d => d.name === val)
    if (dist) {
      setIsLoadingNeighborhoods(true)
      fetch(`https://turkiyeapi.dev/api/v1/districts/${dist.id}`)
        .then(res => res.json())
        .then(res => setNeighborhoods(res.data.neighborhoods || []))
        .finally(() => setIsLoadingNeighborhoods(false))
    }
  }

  const handleSubmit = async () => {
    if (!category.trim() || !city) {
      toast.error("Kategori ve şehir alanları zorunludur")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await startScrape({
        category: category.trim(),
        city,
        district: district || undefined,
        neighborhood: neighborhood || undefined,
      })
      setJobId(result.jobId)
    } catch {
      toast.error("Tarama başlatılamadı")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setCategory("")
    setCity("")
    setDistrict("")
    setNeighborhood("")
    setJobId(null)
    onOpenChange(false)
  }

  const handleShowList = () => {
    handleClose()
    onComplete()
  }

  const isRunning = jobId !== null && job?.status !== "completed" && job?.status !== "failed"
  const isDone = job?.status === "completed"
  const isFailed = job?.status === "failed"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-zinc-700 bg-zinc-900 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">
            {isRunning ? "Tarama Devam Ediyor..." : (isDone || isFailed) ? "Tarama Sonucu" : "Yeni Tarama Başlat"}
          </DialogTitle>
        </DialogHeader>

        {!isRunning && !isDone && !isFailed ? (
          /* STATE 1: Form */
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="scrape-category" className="text-zinc-400">
                Kategori *
              </Label>
              <Input
                id="scrape-category"
                placeholder="Örn: Kafe, Kahveci, Espresso..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
              />
              <p className="text-[10px] text-zinc-500">
                Birden fazla kategoriyi virgülle ayırarak yazabilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scrape-city" className="text-zinc-400">
                  Şehir *
                </Label>
                <Select value={city} onValueChange={handleCityChange}>
                  <SelectTrigger id="scrape-city" className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-200">
                    <SelectValue placeholder={isLoadingProvinces ? "Yükleniyor..." : "Şehir seçin"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-zinc-700 bg-zinc-900">
                    {provinces.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scrape-district" className="text-zinc-400">
                  İlçe
                </Label>
                <Select value={district} onValueChange={handleDistrictChange} disabled={!city || isLoadingDistricts}>
                  <SelectTrigger id="scrape-district" className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-200">
                    <SelectValue placeholder={isLoadingDistricts ? "Yükleniyor..." : "İlçe seçin"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 border-zinc-700 bg-zinc-900">
                    {districts.map((d) => (
                      <SelectItem key={d.id} value={d.name}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="scrape-neighborhood" className="text-zinc-400">
                Mahalle
              </Label>
              <Select value={neighborhood} onValueChange={setNeighborhood} disabled={!district || isLoadingNeighborhoods}>
                <SelectTrigger id="scrape-neighborhood" className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-200">
                  <SelectValue placeholder={isLoadingNeighborhoods ? "Yükleniyor..." : "Mahalle seçin"} />
                </SelectTrigger>
                <SelectContent className="max-h-60 border-zinc-700 bg-zinc-900">
                  {neighborhoods.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Başlatılıyor...
                </>
              ) : (
                "Taramayı Başlat"
              )}
            </Button>
          </div>
        ) : (
          /* STATE 2: Progress */
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              {!isDone && !isFailed && (
                <div className="relative">
                  <Loader2 className="size-12 animate-spin text-emerald-400" />
                  <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/10" />
                </div>
              )}

              {isDone && (
                <CheckCircle2 className="size-12 text-emerald-400" />
              )}

              {isFailed && (
                <AlertCircle className="size-12 text-red-400" />
              )}

              <div className="text-center">
                <p className="text-lg font-semibold text-zinc-200">
                  {isDone
                    ? `✅ ${job?.total_leads ?? job?.current_lead ?? 0} işletme eklendi`
                    : isFailed
                      ? "Tarama başarısız oldu"
                      : `${job?.current_lead ?? 0} işletme bulundu`}
                </p>
                {job && <StatusBadge status={job.status} className="mt-2" />}
              </div>
            </div>

            {/* Progress bar */}
            {job && job.total_leads && !isDone && !isFailed && (
              <div className="space-y-2">
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${Math.min(
                        (job.current_lead / job.total_leads) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-center text-xs text-zinc-500">
                  {job.current_lead} / {job.total_leads}
                </p>
              </div>
            )}

            {isFailed && job?.error_message && (
              <p className="rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400">
                {job.error_message}
              </p>
            )}

            {isDone && (
              <Button
                onClick={handleShowList}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Listeyi Göster
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
