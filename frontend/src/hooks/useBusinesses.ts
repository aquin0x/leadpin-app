"use client"

import { useQuery } from "@tanstack/react-query"
import { getBusinesses } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"
import type { BusinessFilters } from "@/types"

export function useBusinesses(filters: BusinessFilters) {
  return useQuery({
    queryKey: queryKeys.businesses.list(filters),
    queryFn: () => getBusinesses(filters),
  })
}
