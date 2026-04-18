"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListPlus, Plus, Loader2, FolderOpen } from "lucide-react"
import { api } from "@/lib/api-client"
import toast from "react-hot-toast"

interface List {
  id: string
  name: string
  items_count?: [{ count: number }]
}

interface AddToListModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessIds: string[]
  onSuccess: () => void
}

export function AddToListModal({
  open,
  onOpenChange,
  businessIds,
  onSuccess,
}: AddToListModalProps) {
  const [lists, setLists] = useState<List[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [newListName, setNewListName] = useState("")

  const fetchLists = async () => {
    try {
      setIsLoading(true)
      const data = await api.get<List[]>("/api/lists")
      setLists(data)
    } catch (err) {
      console.error("Listeler yüklenemedi")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchLists()
      setShowNewListInput(false)
      setNewListName("")
    }
  }, [open])

  const handleAddSet = async (listId: string) => {
    try {
      setIsSubmitting(true)
      await api.post(`/api/lists/${listId}/items`, { businessIds })
      toast.success("İşletmeler listeye eklendi")
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      toast.error("Bir hata oluştu")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) return

    try {
      setIsSubmitting(true)
      const newList = await api.post<List>("/api/lists", { name: newListName })
      await handleAddSet(newList.id)
    } catch (err) {
      toast.error("Liste oluşturulamadı")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-900 sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <ListPlus className="size-5 text-blue-400" />
            Listeye Kaydet ({businessIds.length} Seçili)
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-zinc-500" />
            </div>
          ) : lists.length > 0 ? (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-2 custom-scrollbar">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => handleAddSet(list.id)}
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 transition-all hover:border-blue-500/50 hover:bg-blue-500/5"
                >
                  <div className="flex items-center gap-3">
                    <FolderOpen className="size-4 text-zinc-500 group-hover:text-blue-400" />
                    <span className="text-sm font-medium text-zinc-300 group-hover:text-white">
                      {list.name}
                    </span>
                  </div>
                  {isSubmitting ? (
                    <Loader2 className="size-3.5 animate-spin text-zinc-500" />
                  ) : (
                    <Plus className="size-4 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </button>
              ))}
            </div>
          ) : !showNewListInput && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-zinc-500">Henüz bir listeniz yok</p>
            </div>
          )}

          {!showNewListInput ? (
            <Button
              variant="outline"
              className="w-full border-dashed border-zinc-700 bg-transparent text-zinc-400 hover:border-blue-500/50 hover:text-blue-400"
              onClick={() => setShowNewListInput(true)}
            >
              <Plus className="mr-2 size-4" />
              Yeni Liste Oluştur
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
              <div className="space-y-2">
                <Label htmlFor="newList" className="text-xs text-zinc-500">Liste Adı</Label>
                <Input
                  id="newList"
                  autoFocus
                  placeholder="Örn: Kadıköy Kafeler..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="h-9 border-zinc-700 bg-zinc-900 text-zinc-200"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="flex-1 text-zinc-500"
                  onClick={() => setShowNewListInput(false)}
                >
                  İptal
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 text-white hover:bg-blue-500"
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Oluştur ve Ekle"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
