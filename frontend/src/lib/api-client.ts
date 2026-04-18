import { createClient } from "@/lib/supabase-client"
import type { BusinessFilters, PaginatedBusinesses, Business, ScrapeJob } from "@/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  } else {
    console.warn("[getAuthHeaders] Token bulunamadı! Oturum kapalı olabilir.");
  }

  return headers
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders()
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
  const url = `${base.replace(/\/$/, "")}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      console.warn("[fetchApi] Yetkisiz erişim! Oturumunuz sona ermiş veya geçersiz olabilir.");
    }

    const errorText = await response.text().catch(() => "Okunamayan hata metni")
    console.error(`API Hatası [${response.status}]:`, errorText)
    throw new ApiError(
      `Sunucu hatası (${response.status})`,
      response.status
    )
  }

  return response.json()
}

export async function getBusinesses(
  filters: BusinessFilters
): Promise<PaginatedBusinesses> {
  const params = new URLSearchParams()

  if (filters.city) params.set("city", filters.city)
  if (filters.district) params.set("district", filters.district)
  if (filters.neighborhood) params.set("neighborhood", filters.neighborhood)
  if (filters.category) params.set("category", filters.category)
  if (filters.hasEmail != null) params.set("hasEmail", String(filters.hasEmail))
  if (filters.hasWebsite != null) params.set("hasWebsite", String(filters.hasWebsite))
  if (filters.hasPhone != null) params.set("hasPhone", String(filters.hasPhone))
  if (filters.minRating != null) params.set("minRating", String(filters.minRating))
  if (filters.minReviews != null) params.set("minReviews", String(filters.minReviews))
  if (filters.sortBy) params.set("sortBy", filters.sortBy)
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder)
  if (filters.page != null) params.set("page", String(filters.page))
  if (filters.limit != null) params.set("limit", String(filters.limit))

  const query = params.toString()
  return fetchApi<PaginatedBusinesses>(
    `/api/businesses${query ? `?${query}` : ""}`
  )
}

export async function getBusiness(id: string): Promise<Business> {
  return fetchApi<Business>(`/api/businesses/${id}`)
}

export interface DashboardStats {
  total: number
  withWebsite: number
  withPhone: number
  thisMonth: number
}

export async function getStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>("/api/stats")
}

export async function listScrapeJobs(): Promise<ScrapeJob[]> {
  return fetchApi<ScrapeJob[]>("/api/scrape-jobs")
}

export async function stopScrapeJob(id: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/api/scrape/${id}/stop`, {
    method: "POST",
  })
}

export async function deleteScrapeJob(id: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/api/scrape/${id}`, {
    method: "DELETE",
  })
}

export async function getScrapeJob(id: string): Promise<ScrapeJob> {
  return fetchApi<ScrapeJob>(`/api/scrape/${id}`)
}

export async function startScrape(data: {
  category: string
  city: string
  district?: string
  neighborhood?: string
}): Promise<{ jobId: string }> {
  return fetchApi<{ jobId: string }>("/api/scrape", {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function clearAllData(): Promise<{ message: string }> {
  return fetchApi<{ message: string }>("/api/admin/clear-data", {
    method: "POST",
  })
}

export async function logWhatsApp(data: {
  businessId: string
  message: string
}): Promise<{ waLink: string; logId: string }> {
  return fetchApi<{ waLink: string; logId: string }>("/api/outreach/whatsapp-log", {
    method: "POST",
    body: JSON.stringify({
      businessId: data.businessId,
      message_content: data.message,
      type: "whatsapp"
    }),
  })
}

export { API_URL, ApiError, fetchApi }

export const api = {
  get: <T>(url: string) => fetchApi<T>(url, { method: "GET" }),
  post: <T>(url: string, body?: any) => fetchApi<T>(url, { 
    method: "POST", 
    body: body ? JSON.stringify(body) : undefined 
  }),
  put: <T>(url: string, body?: any) => fetchApi<T>(url, { 
    method: "PUT", 
    body: body ? JSON.stringify(body) : undefined 
  }),
  delete: <T>(url: string) => fetchApi<T>(url, { method: "DELETE" }),
}
