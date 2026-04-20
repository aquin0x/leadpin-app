"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Plus, MessageCircle, Trash2, RefreshCw, Phone } from "lucide-react"
import {
  listWhatsAppLines,
  createWhatsAppLine,
  deleteWhatsAppLine,
  reconnectWhatsAppLine,
  clearAllData,
  type WhatsAppLine,
} from "@/lib/api-client"
import { useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ready: { text: "Bağlı", color: "bg-emerald-500/10 text-emerald-400" },
  qr: { text: "QR bekleniyor", color: "bg-amber-500/10 text-amber-400" },
  initializing: { text: "Başlatılıyor", color: "bg-blue-500/10 text-blue-400" },
  authenticated: { text: "Kimliklendirildi", color: "bg-blue-500/10 text-blue-400" },
  disconnected: { text: "Bağlı değil", color: "bg-zinc-800 text-zinc-400" },
  auth_failure: { text: "Kimlik hatası", color: "bg-red-500/10 text-red-400" },
}

export function AccountDialog({ open, onOpenChange }: Props) {
  const [lines, setLines] = useState<WhatsAppLine[]>([])
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [clearing, setClearing] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const tick = async () => {
      try {
        const data = await listWhatsAppLines()
        if (!cancelled) setLines(data)
      } catch {}
    }
    tick()
    const id = setInterval(tick, 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [open])

  const handleAdd = async () => {
    setAdding(true)
    try {
      const line = await createWhatsAppLine(newLabel || undefined)
      setLines((prev) => [...prev, line])
      setNewLabel("")
      toast.success("Hat eklendi, QR oluşturuluyor...")
    } catch {
      toast.error("Hat eklenemedi")
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Bu WhatsApp hattını silmek istediğinize emin misiniz?")) return
    try {
      await deleteWhatsAppLine(id)
      setLines((prev) => prev.filter((l) => l.id !== id))
      toast.success("Hat silindi")
    } catch {
      toast.error("Hat silinemedi")
    }
  }

  const handleReconnect = async (id: string) => {
    try {
      await reconnectWhatsAppLine(id)
      toast.success("Yeniden bağlantı başlatıldı")
    } catch {
      toast.error("Yeniden bağlantı başarısız")
    }
  }

  const handleClearData = async () => {
    if (!confirm("Tüm tarama verilerini, işletmeleri ve logları silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) return
    setClearing(true)
    try {
      await clearAllData()
      toast.success("Tüm veriler silindi")
      queryClient.invalidateQueries()
      onOpenChange(false)
    } catch {
      toast.error("Veriler silinirken bir hata oluştu")
    } finally {
      setClearing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Hesap</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* WhatsApp Hatları */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-400" />
              <span className="font-semibold text-zinc-100">WhatsApp Hatları</span>
            </div>

            <div className="space-y-2">
              {lines.length === 0 && (
                <p className="text-xs text-zinc-500">Henüz eklenmiş hat yok. Aşağıdan ekleyin.</p>
              )}
              {lines.map((line) => {
                const badge = STATUS_LABEL[line.status] || STATUS_LABEL.disconnected
                return (
                  <div
                    key={line.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-100 truncate">{line.label}</div>
                        {line.phone && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Phone className="size-3" />
                            {line.phone}
                          </div>
                        )}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.color}`}>
                        {badge.text}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleReconnect(line.id)}
                        className="size-7 text-zinc-500 hover:text-zinc-200"
                        title="Yeniden bağlan"
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(line.id)}
                        className="size-7 text-zinc-500 hover:text-red-400"
                        title="Hattı sil"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    {line.status === "qr" && line.qr && (
                      <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-white p-3">
                        <img src={line.qr} alt="QR" className="size-48" />
                        <p className="mt-2 text-center text-[10px] text-zinc-600">
                          Telefon &gt; WhatsApp &gt; Bağlı Cihazlar &gt; Cihaz Ekle
                        </p>
                      </div>
                    )}
                    {(line.status === "initializing" || line.status === "authenticated") && !line.qr && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="size-5 animate-spin text-emerald-400" />
                      </div>
                    )}
                    {line.lastError && (
                      <div className="text-xs text-red-400">{line.lastError}</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Hat adı (örn. Ana Hat, Satış)"
                className="flex-1 h-9"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
              <Button
                onClick={handleAdd}
                disabled={adding}
                className="bg-emerald-600 hover:bg-emerald-500"
              >
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Numara Ekle
              </Button>
            </div>
          </section>

          {/* Veri Bölümü */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="size-5 text-red-400" />
              <span className="font-semibold text-zinc-100">Veriler</span>
            </div>
            <p className="text-xs text-zinc-500">
              Tüm işletmeleri, listeleri, tarama geçmişini ve outreach loglarını siler. Geri alınamaz.
            </p>
            <Button
              onClick={handleClearData}
              disabled={clearing}
              variant="ghost"
              className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              {clearing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
              Tüm Verileri Sil
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
