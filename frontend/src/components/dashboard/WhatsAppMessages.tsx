"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { listWhatsAppOutreach, type WhatsAppOutreachRow } from "@/lib/api-client"
import { Search, MessageCircle, MousePointerClick } from "lucide-react"

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

export function WhatsAppMessages() {
  const [rows, setRows] = useState<WhatsAppOutreachRow[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10">
            <MessageCircle className="size-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Gönderilen WhatsApp Mesajları</h2>
            <p className="text-xs text-zinc-500">
              {loading ? "Yükleniyor..." : `Toplam ${total} gönderim`}
            </p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İşletme adı, telefon veya short_id ile ara..."
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
        <table className="w-full text-sm">
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
    </div>
  )
}
