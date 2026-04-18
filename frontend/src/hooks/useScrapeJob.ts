"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase-client"
import type { ScrapeJob } from "@/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

export function useScrapeJob(jobId: string | null) {
  const [job, setJob] = useState<ScrapeJob | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchJobStatus = useCallback(async () => {
    if (!jobId) return

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      const response = await fetch(`${API_URL}/api/scrape/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token || ""}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setJob(data)
      }
    } catch (error) {
      console.error("Error fetching job status:", error)
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      return
    }

    // Initial fetch
    fetchJobStatus()

    // Polling interval: every 2 seconds
    const interval = setInterval(() => {
      // Only poll if job is still in progress
      if (!job || (job.status !== "completed" && job.status !== "failed" && job.status !== "stopped")) {
        fetchJobStatus()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [jobId, fetchJobStatus, job?.status])

  return { job, isFetching: isLoading }
}
