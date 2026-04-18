import type { BusinessFilters } from "@/types"

export const queryKeys = {
  businesses: {
    all: ["businesses"] as const,
    list: (filters: BusinessFilters) => ["businesses", "list", filters] as const,
    detail: (id: string) => ["businesses", "detail", id] as const,
    stats: () => ["businesses", "stats"] as const,
  },
  scrapeJobs: {
    all: ["scrapeJobs"] as const,
    list: () => ["scrapeJobs", "list"] as const,
    detail: (id: string) => ["scrapeJobs", "detail", id] as const,
  },
}
