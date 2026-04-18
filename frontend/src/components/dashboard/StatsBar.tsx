"use client"

import {
  Building2,
  Phone,
  Globe,
  CalendarPlus,
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
      icon: CalendarPlus,
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
  ]

  return (
    <div className="flex flex-wrap gap-3 h-full">
      {items.map((stat) => (
        <Card
          key={stat.label}
          className="border-zinc-800 bg-zinc-900/40 backdrop-blur-sm transition-all duration-150 hover:border-zinc-700 hover:bg-zinc-900/60 flex-1 min-w-[160px] h-full"
        >
          <CardContent className="flex items-center gap-3 p-3 h-full justify-center">
            <div className={`rounded-lg p-2 ${stat.bgColor}`}>
              <stat.icon className={`size-4 ${stat.color}`} />
            </div>
            <div>
              {isLoading ? (
                <div className="h-6 w-12 animate-pulse rounded bg-zinc-800" />
              ) : (
                <p className="text-xl font-bold tracking-tight text-zinc-100">
                  {stat.value}
                </p>
              )}
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider leading-none mt-1">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
