"use client"

import { useState } from "react"
import { StickyNote, Save, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { updateBusiness } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { Business } from "@/types"
import toast from "react-hot-toast"

export function NotesCard({ business }: { business: Business }) {
  const [notes, setNotes] = useState(business.notes || "")
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => updateBusiness(business.id, { notes: notes.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.businesses.all })
      toast.success("Not kaydedildi")
    },
    onError: () => toast.error("Not kaydedilemedi"),
  })

  const dirty = (business.notes || "") !== notes

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-zinc-300">
          <StickyNote className="size-4 text-amber-400" />
          Notlar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Bu lead hakkında notlarınız (görüşme özeti, takip tarihi, özel istekler...)"
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!dirty || mutation.isPending}
            className="bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-40"
          >
            {mutation.isPending ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 size-3.5" />
            )}
            Kaydet
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
