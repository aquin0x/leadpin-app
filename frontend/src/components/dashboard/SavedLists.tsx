"use client"

import { useState, useEffect } from "react"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  FolderOpen, 
  Trash2, 
  ChevronRight,
  Loader2,
  Inbox
} from "lucide-react"
import toast from "react-hot-toast"
import { cn } from "@/lib/utils"

interface List {
  id: string
  name: string
  items_count?: [{ count: number }]
  created_at: string
}

export function SavedLists({ onSelectList }: { onSelectList: (id: string, name: string) => void }) {
  const [lists, setLists] = useState<List[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchLists = async () => {
    try {
      setIsLoading(true)
      console.log("[SavedLists] Fetching lists...")
      const data = await api.get<List[]>("/api/lists")
      console.log("[SavedLists] Received data:", data)
      setLists(data)
    } catch (err) {
      console.error("[SavedLists] Fetch error:", err)
      toast.error("Listeler yüklenemedi")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("Bu listeyi silmek istediğinize emin misiniz?")) return

    try {
      await api.delete(`/api/lists/${id}`)
      toast.success("Liste silindi")
      setLists(lists.filter(l => l.id !== id))
    } catch (err) {
      toast.error("Liste silinemedi")
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (lists.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-zinc-900 shadow-inner">
          <Inbox className="size-8 text-zinc-700" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-200">Henüz listeniz yok</h3>
        <p className="mt-2 max-w-xs text-sm text-zinc-500">
          İşletmeleri tablodan seçip "Listeye Kaydet" butonuna basarak ilk listenizi oluşturabilirsiniz.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {lists.map((list) => {
        const count = list.items_count?.[0]?.count || 0
        return (
          <Card
            key={list.id}
            onClick={() => onSelectList(list.id, list.name)}
            className="group/list cursor-pointer border-zinc-800 bg-zinc-900/40 transition-all hover:border-blue-500/50 hover:bg-zinc-900/60"
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 p-5 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 shadow-lg shadow-blue-500/5 group-hover/list:bg-blue-500/20">
                  <FolderOpen className="size-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-100 group-hover/list:text-white line-clamp-1">
                    {list.name}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {new Date(list.created_at).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-2xl font-black italic text-zinc-100">
                    {count}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    İşletme
                  </span>
                </div>
                <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover/list:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectList(list.id, list.name)
                    }}
                    className="size-8 text-zinc-400 hover:bg-blue-500/10 hover:text-blue-400 rounded-lg"
                  >
                    <FolderOpen className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(list.id)
                    }}
                    className="size-8 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <ChevronRight className="size-4 text-zinc-700 transition-transform group-hover/list:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
