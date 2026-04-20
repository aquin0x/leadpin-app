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

export type WhatsAppSessionStatus =
  | "disconnected"
  | "initializing"
  | "qr"
  | "authenticated"
  | "ready"
  | "auth_failure"

export interface WhatsAppLine {
  id: string
  label: string
  phone?: string
  status: WhatsAppSessionStatus
  qr: string | null
  lastError?: string
  createdAt: number
}

export interface WhatsAppStatus {
  status: WhatsAppSessionStatus
  qr: string | null
  lastError: string | null
  campaign: WhatsAppCampaign | null
}

export interface WhatsAppCampaign {
  id: string
  userId: string
  listId: string
  total: number
  processed: number
  sent: number
  failed: number
  skipped: number
  status: "running" | "paused" | "completed" | "stopped" | "failed"
  currentLead?: string
  startedAt: number
  finishedAt?: number
  lastError?: string
}

export async function listWhatsAppLines(): Promise<WhatsAppLine[]> {
  const { lines } = await fetchApi<{ lines: WhatsAppLine[] }>("/api/whatsapp/lines")
  return lines
}

export async function createWhatsAppLine(label?: string): Promise<WhatsAppLine> {
  return fetchApi<WhatsAppLine>("/api/whatsapp/lines", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  })
}

export async function getWhatsAppLine(id: string): Promise<WhatsAppLine> {
  return fetchApi<WhatsAppLine>(`/api/whatsapp/lines/${id}`)
}

export async function deleteWhatsAppLine(id: string): Promise<{ message: string }> {
  return fetchApi<{ message: string }>(`/api/whatsapp/lines/${id}`, { method: "DELETE" })
}

export async function reconnectWhatsAppLine(id: string): Promise<{ status: string }> {
  return fetchApi<{ status: string }>(`/api/whatsapp/lines/${id}/reconnect`, { method: "POST" })
}

export interface WhatsAppMedia {
  data: string
  mimeType: string
  filename: string
}

export async function startWhatsAppCampaign(body: {
  listId: string
  lineId?: string
  messageTemplate: string
  messageTemplateNoWebsite?: string
  minDelaySec?: number
  maxDelaySec?: number
  coffeeBreakEvery?: number
  coffeeBreakMinutes?: number
  media?: WhatsAppMedia
}): Promise<WhatsAppCampaign> {
  return fetchApi<WhatsAppCampaign>("/api/whatsapp/campaign/start", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export async function stopWhatsAppCampaign(): Promise<{ message: string; campaign: WhatsAppCampaign }> {
  return fetchApi("/api/whatsapp/campaign/stop", { method: "POST" })
}

export type SendSingleResult =
  | { ok: true; lineId: string }
  | { ok: false; reason: "no_line"; hint: string }
  | { ok: false; reason: "not_ready"; lines: WhatsAppLine[] }
  | { ok: false; reason: "no_phone" | "no_whatsapp" | "send_failed"; error?: string }

export async function sendWhatsAppSingle(body: {
  businessId: string
  message: string
  lineId?: string
  media?: WhatsAppMedia
}): Promise<SendSingleResult> {
  const headers = await getAuthHeaders()
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
  const res = await fetch(`${base.replace(/\/$/, "")}/api/whatsapp/send-single`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.ok) return { ok: true, lineId: data?.lineId ?? "" }
  if (res.status === 409) return data as SendSingleResult
  return { ok: false, reason: "send_failed", error: data?.error || data?.message || "Hata" }
}

export interface WhatsAppOutreachRow {
  id: string
  status: "sent" | "failed" | "skipped"
  message_content: string
  created_at: string
  business: {
    id: string
    name: string
    phone: string | null
    short_id: string | null
    short_id_clicks: number
    short_id_last_click_at: string | null
  } | null
}

export async function listWhatsAppOutreach(
  search?: string,
  limit = 100,
  offset = 0
): Promise<{ rows: WhatsAppOutreachRow[]; total: number }> {
  const params = new URLSearchParams()
  if (search) params.set("search", search)
  params.set("limit", String(limit))
  params.set("offset", String(offset))
  return fetchApi(`/api/outreach/whatsapp?${params.toString()}`)
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
