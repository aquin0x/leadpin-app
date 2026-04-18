"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { MessageCircle, Mail, History } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { OutreachLog } from "@/types"

interface OutreachHistoryProps {
  logs: OutreachLog[]
}

export function OutreachHistory({ logs }: OutreachHistoryProps) {
  if (!logs || logs.length === 0) {
    return (
      <Card className="border-zinc-800 bg-zinc-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
            <History className="size-5 text-zinc-500" />
            İletişim Geçmişi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 py-10">
            <History className="mb-3 size-8 text-zinc-600" />
            <p className="text-sm text-zinc-500">
              Henüz iletişim kurulmadı
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-zinc-100">
          <History className="size-5 text-zinc-500" />
          İletişim Geçmişi
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-zinc-400">Tür</TableHead>
                <TableHead className="text-zinc-400">Mesaj</TableHead>
                <TableHead className="text-zinc-400 text-right">Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <TableCell>
                    {log.type === "whatsapp" ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      >
                        <MessageCircle className="size-3" />
                        WhatsApp
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 border-blue-500/30 bg-blue-500/10 text-blue-400"
                      >
                        <Mail className="size-3" />
                        E-posta
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-zinc-300">
                    {log.message || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-zinc-400">
                    {format(new Date(log.sentAt), "d MMM yyyy, HH:mm", {
                      locale: tr,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
