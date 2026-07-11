export const SLUG_PATTERN = /^[a-z0-9-]{3,50}$/

export const RESERVED_SLUGS = new Set([
  "admin",
  "analytics",
  "api",
  "app",
  "auth",
  "booking",
  "bookings",
  "dashboard",
  "favicon.ico",
  "help",
  "login",
  "logout",
  "onboarding",
  "public",
  "register",
  "settings",
  "setup",
  "signup",
  "static",
  "support",
  "webhook",
  "webhooks",
  "_next",
])

export function normalizeSlug(input: unknown): string {
  if (typeof input !== "string") return ""
  return input.trim().toLowerCase()
}

export function validateSlug(input: unknown): { slug: string; error?: string } {
  const slug = normalizeSlug(input)
  if (!slug) return { slug, error: "slug required" }
  if (!SLUG_PATTERN.test(slug)) {
    return { slug, error: "slug hanya boleh huruf kecil, angka, dan tanda hubung (3-50 karakter)" }
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { slug, error: "slug ini digunakan oleh sistem, pilih nama lain" }
  }
  return { slug }
}

export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null

  let phone = input.trim().replace(/[^\d+]/g, "")
  if (phone.startsWith("+")) phone = phone.slice(1)
  if (phone.startsWith("0")) phone = `62${phone.slice(1)}`
  if (phone.startsWith("8")) phone = `62${phone}`

  if (!/^62\d{8,15}$/.test(phone)) return null
  return phone
}

export function cleanText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return ""
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength)
}

export function parsePositiveInt(input: string): number | null {
  if (!/^\d+$/.test(input)) return null
  const value = Number(input)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export function parseScheduledAt(input: unknown): Date | null {
  if (typeof input !== "string") return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  if (date.getTime() < Date.now() - 60000) return null
  return date
}
