"use client"

import { useMutation } from "@tanstack/react-query"
import { logWhatsApp } from "@/lib/api-client"

export function useWhatsAppOutreach() {
  return useMutation({
    mutationFn: logWhatsApp,
    onSuccess: (data) => {
      // Open WhatsApp link in new tab
      window.open(data.waLink, "_blank")
    },
  })
}
