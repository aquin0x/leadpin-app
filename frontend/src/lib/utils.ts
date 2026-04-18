import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return "—"
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "")

  // Handle Turkish phone numbers
  if (digits.length === 10) {
    // 5xx xxx xxxx
    return `+90 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith("0")) {
    // 05xx xxx xxxx
    return `+90 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  if (digits.length === 12 && digits.startsWith("90")) {
    // 905xx xxx xxxx
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  }
  // Return as-is with + prefix if not matching patterns
  return phone.startsWith("+") ? phone : `+${phone}`
}

export function formatRating(rating: number | undefined | null, reviewCount?: number | null): string {
  if (rating == null) return "—"
  const stars = `⭐ ${rating.toFixed(1)}`
  if (reviewCount != null) {
    return `${stars} (${reviewCount})`
  }
  return stars
}
