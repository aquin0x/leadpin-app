"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import { listScrapeJobs, stopScrapeJob, deleteScrapeJob } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import { History, Clock, CheckCircle2, XCircle, Loader2, StopCircle, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import toast from "react-hot-toast"

export function ScrapeHistory() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const { data: jobs, isLoading } = useQuery({
    queryKey: queryKeys.scrapeJobs.list(),
    queryFn: listScrapeJobs,
    refetchInterval: 5000, 
  })

  const stopMutation = useMutation({
    mutationFn: stopScrapeJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scrapeJobs.all })
      toast.success("Tarama durduruluyor...")
    },
    onError: () => toast.error("Durdurma sırasında bir hata oluştu")
  })

  const deleteMutation = useMutation({
    mutationFn: deleteScrapeJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.scrapeJobs.all })
      toast.success("Kayıt silindi")
    },
    onError: () => toast.error("Silme sırasında bir hata oluştu")
  })

  const handleStop = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Taramayı durdurmak istediğinize emin misiniz?")) {
      stopMutation.mutate(id)
    }
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm("Bu tarama kaydını silmek istediğinize emin misiniz?")) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300 uppercase tracking-wider px-2">
        <History className="size-4 text-zinc-500" />
        Tarama Geçmişi
      </h3>

      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {jobs?.length === 0 ? (
          <p className="text-center text-xs text-zinc-500 py-4">
            Henüz tarama yapılmadı.
          </p>
        ) : (
          jobs?.map((job) => (
            <div
              key={job.id}
              onClick={() => {
                const params = new URLSearchParams()
                if (job.city) params.set("city", job.city)
                if (job.district) params.set("district", job.district)
                if (job.neighborhood) params.set("neighborhood", job.neighborhood)
                if (job.category) params.set("category", job.category)
                
                router.push(`${pathname}?${params.toString()}`)
                toast.success(`${job.category} sonuçları filtrelendi`, { icon: '🔍', duration: 2000 })
              }}
              className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 transition-all hover:border-emerald-500/50 hover:bg-zinc-900/60 cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-200">
                  {job.category}
                </span>
                <div className="flex items-center gap-2">
                  <StatusIcon status={job.status} />
                  
                  {job.status === 'running' && (
                    <button
                      onClick={(e) => handleStop(job.id, e)}
                      className="text-zinc-500 hover:text-red-400 transition-colors"
                      title="Durdur"
                    >
                      <StopCircle className="size-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => handleDelete(job.id, e)}
                    className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="Sil"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-1 text-[11px] text-zinc-500">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span className="truncate flex-1" title={`${job.city} ${job.district ? `/ ${job.district}` : ""} ${job.neighborhood ? `/ ${job.neighborhood}` : ""}`}>
                    {job.city} 
                    {job.district ? ` / ${job.district}` : ""} 
                    {job.neighborhood ? ` / ${job.neighborhood}` : ""}
                  </span>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Clock className="size-3 text-zinc-500" />
                    {format(new Date(job.created_at), "d MMM HH:mm", { locale: tr })}
                  </div>
                </div>
                
                {(job.status === 'running' || job.status === 'completed') ? (
                  <div className="mt-1 flex flex-col gap-1.5">
                    <div className="flex h-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          job.status === 'completed' ? "bg-emerald-500" : "bg-blue-500"
                        )}
                        style={{
                          width: `${Math.min(100, Math.round((job.current_lead / (job.total_leads || 1)) * 100))}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span>İşletme: {job.current_lead} / {job.total_leads}</span>
                      <span>%{Math.round((job.current_lead / (job.total_leads || 1)) * 100)}</span>
                    </div>
                  </div>
                ) : job.status === 'failed' ? (
                  <span className="text-red-900/70 truncate text-[10px] mt-1">
                    {job.error_message || "Hata oluştu"}
                  </span>
                ) : job.status === 'stopped' ? (
                  <span className="text-zinc-500 font-medium text-[10px] mt-1">
                    Tarama durduruldu
                  </span>
                ) : (
                  <span>Sırada bekleniyor...</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-3.5 text-emerald-500" />
    case "failed":
      return <XCircle className="size-3.5 text-red-500" />
    case "running":
      return <Loader2 className="size-3.5 animate-spin text-blue-500" />
    case "stopped":
      return <StopCircle className="size-3.5 text-zinc-500" />
    default:
      return <Clock className="size-3.5 text-zinc-500" />
  }
}
