"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import type { ScrapeJob } from "@/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export function useScrapeJob(jobId: string | null) {
  const [job, setJob] = useState<ScrapeJob | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(async () => {
    if (!jobId) return

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ""

    const url = `${API_URL}/api/scrape/${jobId}/stream?token=${encodeURIComponent(token)}`
    const eventSource = new EventSource(url)

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ScrapeJob
        setJob(data)

        // Close connection when job is terminal
        if (data.status === "done" || data.status === "failed") {
          eventSource.close()
          setIsConnected(false)
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      setIsConnected(false)
    }

    return eventSource
  }, [jobId])

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setIsConnected(false)
      return
    }

    let eventSource: EventSource | undefined

    connect().then((es) => {
      eventSource = es
    })

    return () => {
      if (eventSource) {
        eventSource.close()
        setIsConnected(false)
      }
    }
  }, [jobId, connect])

  return { job, isConnected }
}
