"use client"

import {
  Target,
  Phone,
  Globe,
  Tag,
  Building2,
  ExternalLink,
  Copy,
  Star,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatPhone } from "@/lib/utils"
import type { Business } from "@/types"
import toast from "react-hot-toast"

interface BusinessInfoCardProps {
  business: Business
}

export function BusinessInfoCard({ business }: BusinessInfoCardProps) {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} kopyalandı`)
  }

  const infoItems = [
    {
      icon: Target,
      label: "Adres",
      value: (business.address || "—").replace(/^\+/, "").trim(),
    },
    {
      icon: Phone,
      label: "Telefon",
      value: formatPhone(business.phone),
      copyable: business.phone,
      mono: true,
    },
    {
      icon: Globe,
      label: "Web Sitesi",
      value: business.website || "—",
      link: business.website,
    },
    {
      icon: Tag,
      label: "Kategori",
      value: business.category,
    },
    {
      icon: Building2,
      label: "Şehir",
      value: business.district
        ? `${business.city} / ${business.district}`
        : business.city,
    },
  ]

  return (
    <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-zinc-100">
              {business.name}
            </CardTitle>
            <p className="mt-1 text-sm text-zinc-400">{business.category}</p>
          </div>
          {business.rating != null && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-300"
            >
              <Star className="size-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-semibold">
                {business.rating.toFixed(1)}
              </span>
              {business.reviews_count != null && (
                <span className="text-xs text-amber-400/70">
                  ({business.reviews_count})
                </span>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {infoItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg border border-zinc-800/50 bg-zinc-800/20 p-3"
            >
              <item.icon className="size-4 shrink-0 text-zinc-500" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-zinc-500">{item.label}</p>
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-400 hover:underline"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p
                    className={`text-sm text-zinc-200 ${
                      item.mono ? "font-mono" : ""
                    }`}
                  >
                    {item.value}
                  </p>
                )}
              </div>
              {item.copyable && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => copyToClipboard(item.copyable!, item.label)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <Copy className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {business.google_maps_url && (
          <a href={business.google_maps_url} target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800"
            >
              Google Haritalar&apos;da Gör
              <ExternalLink className="ml-auto size-3.5 text-zinc-500" />
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  )
}
