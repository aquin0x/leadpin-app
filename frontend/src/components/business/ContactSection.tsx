"use client"

import {
  Mail,
  MessageCircle,
  ExternalLink,
  Copy,
  AlertCircle,
  AtSign,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Contact } from "@/types"
import toast from "react-hot-toast"

interface ContactSectionProps {
  contacts: Contact[]
}

export function ContactSection({ contacts }: ContactSectionProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Kopyalandı")
  }

  const hasContacts = contacts.length > 0
  const contact = contacts[0] // Primary contact

  if (!hasContacts) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-100">İletişim Bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-700 p-6">
            <AlertCircle className="size-5 text-zinc-500" />
            <p className="text-sm text-zinc-400">
              İletişim bilgisi bulunamadı
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const contactItems = [
    {
      icon: Mail,
      label: "E-posta",
      value: contact.email,
      href: contact.email ? `mailto:${contact.email}` : undefined,
      color: "text-blue-400",
    },
    {
      icon: AtSign,
      label: "Instagram",
      value: contact.instagram ? `@${contact.instagram.replace("@", "")}` : undefined,
      href: contact.instagram
        ? `https://instagram.com/${contact.instagram.replace("@", "")}`
        : undefined,
      color: "text-pink-400",
    },
    {
      icon: MessageCircle,
      label: "WhatsApp",
      value: contact.whatsapp,
      href: contact.whatsapp
        ? `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`
        : undefined,
      color: "text-emerald-400",
    },
    {
      icon: ExternalLink,
      label: "Facebook",
      value: contact.facebook,
      href: contact.facebook,
      color: "text-blue-500",
    },
  ].filter((item) => item.value)

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="text-lg text-zinc-100">İletişim Bilgileri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contactItems.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-700 p-6">
            <AlertCircle className="size-5 text-zinc-500" />
            <p className="text-sm text-zinc-400">
              Web sitesi taranıyor...
            </p>
          </div>
        ) : (
          contactItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-800/20 p-3"
            >
              <item.icon className={`size-4 shrink-0 ${item.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">{item.label}</p>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-zinc-200 hover:text-emerald-400 transition-colors"
                  >
                    {item.value}
                    <ExternalLink className="size-3 text-zinc-500" />
                  </a>
                ) : (
                  <p className="text-sm text-zinc-200">{item.value}</p>
                )}
              </div>
              {item.value && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => copyToClipboard(item.value!)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <Copy className="size-3" />
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
