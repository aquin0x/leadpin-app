"use client"

import {
  Building2,
  Phone,
  Globe,
  Calendar,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { getStats } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

export function StatsBar() {
  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.businesses.stats(),
    queryFn: getStats,
  })

  const items = [
    {
      label: "Toplam Lead",
      value: stats?.total ?? 0,
      icon: Building2,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Telefon Var",
      value: stats?.withPhone ?? 0,
      icon: Phone,
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Web Sitesi Var",
      value: stats?.withWebsite ?? 0,
      icon: Globe,
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
    {
      label: "Bu Ay Eklenen",
      value: stats?.thisMonth ?? 0,
      icon: Calendar,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
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
              {isLoading ? (
                <div className="mt-1 h-7 w-16 animate-pulse rounded bg-zinc-800" />
              ) : (
                <p className="text-2xl font-bold tracking-tight text-zinc-100">
                  {stat.value.toLocaleString('tr-TR')}
                </p>
              )}
            </div>
            
            {/* Subtle glow effect on hover */}
            <div className={`absolute -inset-px -z-10 rounded-xl opacity-0 transition-opacity blur-sm group-hover:opacity-10 ${stat.bgColor}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
