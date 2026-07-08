"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { listWhatsAppOutreach, listInbox, type WhatsAppOutreachRow, type InboxRow } from "@/lib/api-client"
import { Search, MessageCircle, MousePointerClick, Send, Building2, Target, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

const STATUS_COLOR: Record<string, string> = {
  sent: "text-emerald-400 bg-emerald-500/10",
  failed: "text-red-400 bg-red-500/10",
  skipped: "text-zinc-400 bg-zinc-500/10",
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function StatsGrid({ rows, total, loading }: { rows: WhatsAppOutreachRow[]; total: number; loading: boolean }) {
  const stats = useMemo(() => {
    const uniqueBiz = new Map<string, { clicks: number }>()
    for (const r of rows) {
      const b = r.business
      if (!b?.id) continue
      if (!uniqueBiz.has(b.id)) uniqueBiz.set(b.id, { clicks: b.short_id_clicks || 0 })
    }
    let totalClicks = 0
    let clickedBiz = 0
    for (const { clicks } of uniqueBiz.values()) {
      totalClicks += clicks
      if (clicks > 0) clickedBiz += 1
    }
    return {
      sent: total,
      uniqueBiz: uniqueBiz.size,
      clickedBiz,
      totalClicks,
    }
  }, [rows, total])

  const items = [
    { label: "Toplam Gönderim", value: stats.sent, icon: Send, color: "text-emerald-400", bgColor: "bg-emerald-400/10" },
    { label: "İşletme Sayısı", value: stats.uniqueBiz, icon: Building2, color: "text-blue-400", bgColor: "bg-blue-400/10" },
    { label: "Linke Tıklayan", value: stats.clickedBiz, icon: Target, color: "text-amber-400", bgColor: "bg-amber-400/10" },
    { label: "Toplam Tıklama", value: stats.totalClicks, icon: MousePointerClick, color: "text-purple-400", bgColor: "bg-purple-400/10" },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((stat) => (
        <Card
          key={stat.label}
          className="group relative border-zinc-800 bg-zinc-900/40 backdrop-blur-sm transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-900/60"
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`flex size-11 items-center justify-center rounded-xl transition-colors ${stat.bgColor}`}>
              <stat.icon className={`size-5 ${stat.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-zinc-500">
                {stat.label}
              </p>
              {loading ? (
                <div className="mt-1 h-7 w-16 animate-pulse rounded bg-zinc-800" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-zinc-100">
                  {stat.value.toLocaleString("tr-TR")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function InboxPanel() {
  const [rows, setRows] = useState<InboxRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    listInbox(200)
      .then(({ rows }) => {
        if (!cancelled) setRows(rows)
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
          <tr>
            <th className="text-left px-4 py-3">İşletme</th>
            <th className="text-left px-4 py-3">Telefon</th>
            <th className="text-left px-4 py-3">Mesaj</th>
            <th className="text-left px-4 py-3">Durum</th>
            <th className="text-left px-4 py-3">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={5} className="text-center py-10 text-zinc-500">
                Henüz gelen mesaj yok. Bir lead cevap verdiğinde burada görünür ve durumu
                otomatik olarak "Cevap Verdi" yapılır.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
              <td className="px-4 py-3 text-zinc-200">{r.business?.name || "Bilinmeyen"}</td>
              <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{r.from_phone}</td>
              <td className="px-4 py-3 text-zinc-300 max-w-[320px]">
                <span className="block truncate" title={r.body || ""}>{r.body || "—"}</span>
              </td>
              <td className="px-4 py-3">
                {r.business ? (
                  <span className="inline-flex rounded px-2 py-0.5 text-xs text-amber-400 bg-amber-500/10">
                    {r.business.status}
                  </span>
                ) : (
                  <span className="text-zinc-600 text-xs">eşleşmedi</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(r.received_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function WhatsAppMessages() {
  const [rows, setRows] = useState<WhatsAppOutreachRow[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<"sent" | "inbox">("sent")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const { rows, total } = await listWhatsAppOutreach(search || undefined, 200)
        if (!cancelled) {
          setRows(rows)
          setTotal(total)
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10">
          <MessageCircle className="size-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">WhatsApp Mesajları</h2>
          <p className="text-xs text-zinc-500">Gönderilen mesajlar ve tıklama istatistikleri</p>
        </div>
      </div>

      <StatsGrid rows={rows} total={total} loading={loading} />

      {/* Sekmeler: Gönderilen / Gelen Kutusu */}
      <div className="flex gap-1 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-1 w-fit">
        <button
          onClick={() => setTab("sent")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "sent" ? "bg-emerald-500/10 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Send className="size-4" /> Gönderilen
        </button>
        <button
          onClick={() => setTab("inbox")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "inbox" ? "bg-amber-500/10 text-amber-400" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Inbox className="size-4" /> Gelen Kutusu
        </button>
      </div>

      {tab === "inbox" ? (
        <InboxPanel />
      ) : (
        <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İşletme adı, telefon veya short_id ile ara..."
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-500">
            <tr>
              <th className="text-left px-4 py-3">İşletme</th>
              <th className="text-left px-4 py-3">Telefon</th>
              <th className="text-left px-4 py-3">Short ID</th>
              <th className="text-left px-4 py-3">Tıklama</th>
              <th className="text-left px-4 py-3">Durum</th>
              <th className="text-left px-4 py-3">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-500">
                  Henüz gönderilmiş WhatsApp mesajı yok.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const b = r.business
              return (
                <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  <td className="px-4 py-3 text-zinc-200">{b?.name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400 font-mono text-xs">{b?.phone || "—"}</td>
                  <td className="px-4 py-3 text-emerald-400 font-mono text-xs">
                    {b?.short_id || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {b && b.short_id_clicks > 0 ? (
                      <span
                        className="inline-flex items-center gap-1 text-amber-400"
                        title={
                          b.short_id_last_click_at
                            ? `Son: ${formatDate(b.short_id_last_click_at)}`
                            : undefined
                        }
                      >
                        <MousePointerClick className="size-3" />
                        {b.short_id_clicks}
                      </span>
                    ) : (
                      <span className="text-zinc-600">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded px-2 py-0.5 text-xs ${
                        STATUS_COLOR[r.status] || "text-zinc-400"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(r.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  )
}
