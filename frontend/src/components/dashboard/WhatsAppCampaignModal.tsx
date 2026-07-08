"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, MessageCircle, Square, Paperclip, X, Save, Trash2 } from "lucide-react"
import {
  listWhatsAppLines,
  startWhatsAppCampaign,
  stopWhatsAppCampaign,
  listTemplates,
  createTemplate,
  deleteTemplate,
  type WhatsAppLine,
  type WhatsAppCampaign,
  type MessageTemplate,
} from "@/lib/api-client"
import { api } from "@/lib/api-client"
import toast from "react-hot-toast"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  listName: string
  leadCount: number
}

const DEFAULT_TEMPLATE =
  "{greeting} {name}, web sitenizi modern bir randevu ve CRM sistemiyle entegre ederek müşteri yönetimini kolaylaştırabiliriz. Detaylar için görüşebiliriz."

const DEFAULT_TEMPLATE_NO_WEBSITE =
  "{greeting} {name}, Google Haritalar profilinizi inceledim. Henüz bir web sitenizin olmadığını fark ettim. Size özel modern bir site ve randevu sistemiyle müşteri trafiğinizi artırabiliriz. İlgilenir misiniz?"

const MAX_MEDIA_BYTES = 20 * 1024 * 1024 // 20MB

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function WhatsAppCampaignModal({
  open,
  onOpenChange,
  listId,
  listName,
  leadCount,
}: Props) {
  const [lines, setLines] = useState<WhatsAppLine[]>([])
  const [campaign, setCampaign] = useState<WhatsAppCampaign | null>(null)
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([])
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE)
  const [templateNoWebsite, setTemplateNoWebsite] = useState(DEFAULT_TEMPLATE_NO_WEBSITE)
  const [minDelay, setMinDelay] = useState(60)
  const [maxDelay, setMaxDelay] = useState(120)
  const [coffeeEvery, setCoffeeEvery] = useState(20)
  const [coffeeMin, setCoffeeMin] = useState(15)
  const [sendStartHour, setSendStartHour] = useState(0)
  const [sendEndHour, setSendEndHour] = useState(0)
  const [dailyLimit, setDailyLimit] = useState(0)
  const [starting, setStarting] = useState(false)

  const [savedTemplates, setSavedTemplates] = useState<MessageTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("__default__")
  const [mediaFile, setMediaFile] = useState<File | null>(null)

  const mediaPreview = useMemo(() => {
    if (!mediaFile) return null
    if (mediaFile.type.startsWith("image/")) return URL.createObjectURL(mediaFile)
    return null
  }, [mediaFile])

  useEffect(() => {
    return () => {
      if (mediaPreview) URL.revokeObjectURL(mediaPreview)
    }
  }, [mediaPreview])

  useEffect(() => {
    if (!open) return
    listTemplates()
      .then(setSavedTemplates)
      .catch(() => toast.error("Şablonlar yüklenemedi"))
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const tick = async () => {
      try {
        const [ls, camp] = await Promise.all([
          listWhatsAppLines(),
          api.get<{ campaign: WhatsAppCampaign | null }>("/api/whatsapp/campaign").catch(() => ({ campaign: null })),
        ])
        if (cancelled) return
        setLines(ls)
        setCampaign(camp.campaign ?? null)
        setSelectedLineIds((prev) => {
          // Seçimi koru; hiç seçim yoksa tüm hazır hatları varsayılan seç (rotasyon)
          const valid = prev.filter((id) => ls.some((l) => l.id === id))
          if (valid.length > 0) return valid
          return ls.filter((l) => l.status === "ready").map((l) => l.id)
        })
      } catch {
        // ignore polling errors
      }
    }

    tick()
    const id = setInterval(tick, 2500)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [open])

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id)
    if (id === "__default__") {
      setTemplate(DEFAULT_TEMPLATE)
      setTemplateNoWebsite(DEFAULT_TEMPLATE_NO_WEBSITE)
      return
    }
    const t = savedTemplates.find((s) => s.id === id)
    if (t) {
      setTemplate(t.template)
      setTemplateNoWebsite(t.template_no_website || "")
    }
  }

  const handleSaveTemplate = async () => {
    const name = prompt("Şablon adı:")
    if (!name?.trim()) return
    try {
      const t = await createTemplate({
        name: name.trim(),
        template,
        template_no_website: templateNoWebsite || undefined,
      })
      setSavedTemplates((prev) => [t, ...prev])
      setSelectedTemplateId(t.id)
      toast.success("Şablon kaydedildi")
    } catch {
      toast.error("Şablon kaydedilemedi")
    }
  }

  const handleDeleteTemplate = async () => {
    if (selectedTemplateId === "__default__") return
    if (!confirm("Bu şablonu silmek istiyor musunuz?")) return
    try {
      await deleteTemplate(selectedTemplateId)
      setSavedTemplates((prev) => prev.filter((s) => s.id !== selectedTemplateId))
      setSelectedTemplateId("__default__")
      setTemplate(DEFAULT_TEMPLATE)
      setTemplateNoWebsite(DEFAULT_TEMPLATE_NO_WEBSITE)
      toast.success("Şablon silindi")
    } catch {
      toast.error("Şablon silinemedi")
    }
  }

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const ok =
      f.type.startsWith("image/") ||
      f.type === "application/pdf" ||
      /\.(png|jpe?g|gif|webp|pdf)$/i.test(f.name)
    if (!ok) {
      toast.error("Sadece görsel veya PDF ekleyebilirsiniz")
      return
    }
    if (f.size > MAX_MEDIA_BYTES) {
      toast.error("Dosya 20MB'dan büyük olamaz")
      return
    }
    setMediaFile(f)
  }

  const handleStart = async () => {
    if (!template.trim()) {
      toast.error("Mesaj şablonu boş olamaz")
      return
    }
    setStarting(true)
    try {
      let media: { data: string; mimeType: string; filename: string } | undefined
      if (mediaFile) {
        const data = await fileToBase64(mediaFile)
        media = {
          data,
          mimeType: mediaFile.type || "application/octet-stream",
          filename: mediaFile.name,
        }
      }
      await startWhatsAppCampaign({
        listId,
        lineIds: selectedLineIds,
        messageTemplate: template,
        messageTemplateNoWebsite: templateNoWebsite || undefined,
        minDelaySec: minDelay,
        maxDelaySec: maxDelay,
        coffeeBreakEvery: coffeeEvery,
        coffeeBreakMinutes: coffeeMin,
        sendStartHour,
        sendEndHour,
        dailyLimit,
        media,
      })
      toast.success("Kampanya başlatıldı")
    } catch (e: any) {
      toast.error(e.message || "Başlatılamadı")
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    try {
      await stopWhatsAppCampaign()
      toast.success("Durdurma isteği gönderildi")
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const readyLines = lines.filter((l) => l.status === "ready")
  const selectedReadyCount = selectedLineIds.filter(
    (id) => lines.find((l) => l.id === id)?.status === "ready"
  ).length
  const isRunning = campaign?.status === "running"
  const progress = campaign && campaign.total > 0
    ? Math.round((campaign.processed / campaign.total) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-400" />
            WhatsApp Kampanyası — {listName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500 uppercase tracking-wider">
                Gönderim Hatları (rotasyon)
              </div>
              {readyLines.length === 0 && (
                <span className="text-xs text-amber-400">Hesap'tan WhatsApp hattı ekleyin</span>
              )}
            </div>
            {readyLines.length === 0 ? (
              <p className="text-sm text-zinc-500">Hazır hat yok</p>
            ) : (
              <div className="space-y-1.5">
                {readyLines.map((l) => {
                  const checked = selectedLineIds.includes(l.id)
                  return (
                    <label
                      key={l.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedLineIds((prev) =>
                            e.target.checked ? [...prev, l.id] : prev.filter((id) => id !== l.id)
                          )
                        }
                        className="accent-emerald-500"
                      />
                      <span>{l.label}{l.phone ? ` — ${l.phone}` : ""}</span>
                    </label>
                  )
                })}
                {selectedReadyCount > 1 && (
                  <p className="text-xs text-zinc-500">
                    Mesajlar {selectedReadyCount} hat arasında sırayla dağıtılır (ban riskini azaltır).
                  </p>
                )}
              </div>
            )}
          </div>

          {campaign && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-300">
                  {campaign.status} — {campaign.processed}/{campaign.total}
                </span>
                <span className="text-zinc-500">
                  ✓ {campaign.sent} · ✗ {campaign.failed} · ⤼ {campaign.skipped}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {campaign.currentLead && (
                <div className="text-xs text-zinc-500">Şu an: {campaign.currentLead}</div>
              )}
              {isRunning && (
                <Button size="sm" variant="ghost" onClick={handleStop} className="text-red-400">
                  <Square className="mr-1 size-3" /> Durdur
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-zinc-400">Şablon</Label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-200 px-2 py-1"
                >
                  <option value="__default__">Varsayılan</option>
                  {savedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Button size="sm" variant="ghost" onClick={handleSaveTemplate} className="text-emerald-400 h-7 px-2">
                  <Save className="size-3 mr-1" /> Kaydet
                </Button>
                {selectedTemplateId !== "__default__" && (
                  <Button size="sm" variant="ghost" onClick={handleDeleteTemplate} className="text-red-400 h-7 px-2">
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">
              Mesaj şablonu — değişkenler: <code className="text-emerald-400">{"{name}"}</code>,{" "}
              <code className="text-emerald-400">{"{greeting}"}</code>
            </Label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Web sitesi olmayanlar için (opsiyonel)</Label>
            <Textarea
              value={templateNoWebsite}
              onChange={(e) => setTemplateNoWebsite(e.target.value)}
              rows={3}
              className="font-mono text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-zinc-400">Ek dosya (görsel / PDF, opsiyonel)</Label>
            {mediaFile ? (
              <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
                {mediaPreview ? (
                  <img src={mediaPreview} alt="" className="size-14 rounded object-cover" />
                ) : (
                  <div className="size-14 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">
                    PDF
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-zinc-200 truncate">{mediaFile.name}</div>
                  <div className="text-xs text-zinc-500">
                    {(mediaFile.size / 1024).toFixed(0)} KB · {mediaFile.type || "bilinmiyor"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setMediaFile(null)} className="text-red-400">
                  <X className="size-3" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-400 cursor-pointer hover:border-zinc-600">
                <Paperclip className="size-4" />
                Dosya seç (maks. 20MB)
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleMediaChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-zinc-500">Min gecikme (sn)</Label>
              <Input type="number" value={minDelay} onChange={(e) => setMinDelay(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Max gecikme (sn)</Label>
              <Input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Mola: her X</Label>
              <Input type="number" value={coffeeEvery} onChange={(e) => setCoffeeEvery(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Mola (dk)</Label>
              <Input type="number" value={coffeeMin} onChange={(e) => setCoffeeMin(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs text-zinc-500">Başlangıç saati</Label>
              <Input
                type="number" min={0} max={23}
                value={sendStartHour}
                onChange={(e) => setSendStartHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Bitiş saati</Label>
              <Input
                type="number" min={0} max={23}
                value={sendEndHour}
                onChange={(e) => setSendEndHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Günlük limit (0=∞)</Label>
              <Input
                type="number" min={0}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">
            Saat penceresi: mesajlar yalnızca bu saatler arasında gönderilir (örn. 09-18).
            İki saat de 0 ise sınırsızdır. Pencere dışında kampanya bekler; günlük limit dolunca durur.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
            <Button
              onClick={handleStart}
              disabled={selectedReadyCount === 0 || isRunning || starting || leadCount === 0}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              {starting ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <MessageCircle className="mr-1 size-3" />
              )}
              {leadCount} leade gönder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
