export interface Business {
  id: string
  name: string
  category: string
  city: string
  district?: string
  neighborhood?: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviews_count?: number
  google_maps_url?: string
  status?: string
  created_at: string
  contacts?: Contact[]
  outreach_logs?: OutreachLog[]
}

export interface Contact {
  id: string
  businessId: string
  email?: string
  instagram?: string
  whatsapp?: string
  facebook?: string
}

export interface OutreachLog {
  id: string
  type: 'whatsapp' | 'email'
  status: string
  message?: string
  sentAt: string
}

export interface ScrapeJob {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  current_lead: number
  total_leads: number
  city: string
  category: string
  district?: string
  neighborhood?: string
  error_message?: string
  created_at: string
}

export interface BusinessFilters {
  city?: string
  district?: string
  neighborhood?: string
  category?: string
  hasEmail?: boolean
  hasWebsite?: boolean
  hasPhone?: boolean
  minRating?: number
  minReviews?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface PaginatedBusinesses {
  data: Business[]
  total: number
  page: number
  totalPages: number
}
