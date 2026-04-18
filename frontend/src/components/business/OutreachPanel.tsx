"use client"

import { useState } from "react"
import { MessageCircle, Mail, Send } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { generateMessages } from "@/lib/message-generator"
import { useWhatsAppOutreach } from "@/hooks/useOutreach"
import { formatPhone } from "@/lib/utils"
import type { Business } from "@/types"
import toast from "react-hot-toast"

interface OutreachPanelProps {
  business: Business
}

export function OutreachPanel({ business }: OutreachPanelProps) {
  const messages = generateMessages(business)
  const [selectedMsg, setSelectedMsg] = useState("0")
  const [customMessage, setCustomMessage] = useState(messages[0])
  const outreach = useWhatsAppOutreach()

  const handleMsgChange = (value: string) => {
    setSelectedMsg(value)
    setCustomMessage(messages[parseInt(value)])
  }

  const handleSendWhatsApp = () => {
    outreach.mutate(
      { businessId: business.id, message: customMessage },
      {
        onSuccess: () => {
          toast.success("WhatsApp açılıyor...")
        },
        onError: () => {
          toast.error("Bir hata oluştu")
        },
      }
    )
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
          <Send className="size-5 text-emerald-400" />
          İletişime Geç
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* WhatsApp Card */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-5 text-emerald-400" />
              <span className="font-semibold text-zinc-200">WhatsApp</span>
            </div>
            {business.phone && (
              <span className="font-mono text-sm text-zinc-400">
                {formatPhone(business.phone)}
              </span>
            )}
          </div>

          <RadioGroup value={selectedMsg} onValueChange={handleMsgChange}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-zinc-700/50 p-3 transition-colors hover:border-zinc-600 has-data-[state=checked]:border-emerald-500/30 has-data-[state=checked]:bg-emerald-500/5"
              >
                <RadioGroupItem value={String(i)} id={`outreach-msg-${i}`} className="mt-0.5" />
                <Label
                  htmlFor={`outreach-msg-${i}`}
                  className="cursor-pointer text-xs leading-relaxed text-zinc-300"
                >
                  {msg}
                </Label>
              </div>
            ))}
          </RadioGroup>

          <Textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={3}
            className="border-zinc-700 bg-zinc-800/50 text-sm text-zinc-200 resize-none"
            placeholder="Mesajınızı düzenleyin..."
          />

          <Button
            onClick={handleSendWhatsApp}
            disabled={outreach.isPending || !customMessage.trim()}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <MessageCircle className="mr-2 size-4" />
            {outreach.isPending ? "Gönderiliyor..." : "WhatsApp'ta Aç"}
          </Button>
        </div>

      </CardContent>
    </Card>
  )
}
