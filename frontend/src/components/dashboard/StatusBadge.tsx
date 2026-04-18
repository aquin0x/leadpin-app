"use client"

import { cn } from "@/lib/utils"
import type { ScrapeJob } from "@/types"
import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: ScrapeJob["status"] | string
  className?: string
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Bekliyor", variant: "secondary" },
  running: { label: "Çalışıyor", variant: "default" },
  done: { label: "Tamamlandı", variant: "outline" },
  failed: { label: "Hata", variant: "destructive" },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    variant: "secondary" as const,
  }

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "text-xs font-medium",
        status === "done" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        status === "running" &&
          "border-blue-500/30 bg-blue-500/10 text-blue-400 animate-pulse",
        className
      )}
    >
      {status === "running" && (
        <span className="mr-1 inline-block size-1.5 rounded-full bg-blue-400 animate-pulse" />
      )}
      {status === "done" && <span className="mr-1">✅</span>}
      {config.label}
    </Badge>
  )
}
