"use client"

import { useMutation } from "@tanstack/react-query"
import { sendWhatsAppSingle, type SendSingleResult } from "@/lib/api-client"

export function useWhatsAppOutreach() {
  return useMutation<SendSingleResult, Error, { businessId: string; message: string }>({
    mutationFn: (vars) => sendWhatsAppSingle(vars),
  })
}
