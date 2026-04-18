"use client"

import { useQuery } from "@tanstack/react-query"
import { getBusiness } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-keys"

export function useBusiness(id: string) {
  return useQuery({
    queryKey: queryKeys.businesses.detail(id),
    queryFn: () => getBusiness(id),
    enabled: !!id,
  })
}
