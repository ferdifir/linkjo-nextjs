import { cleanText } from "@/lib/validation"

export type ServiceInput = {
  id?: unknown
  name?: unknown
  description?: unknown
  duration_minutes?: unknown
  price?: unknown
  active?: unknown
}

export type ServiceSummary = {
  id: string
  name: string
  description: string
  duration_minutes: number
  price: number | null
  active: boolean
}

export function normalizeServiceInputs(input: unknown): Array<Omit<ServiceSummary, "id"> & { id?: string }> {
  if (!Array.isArray(input)) return []

  return input
    .map((item) => normalizeServiceInput(item as ServiceInput))
    .filter((service): service is Omit<ServiceSummary, "id"> & { id?: string } => Boolean(service))
}

export function normalizeServiceInput(input: ServiceInput): (Omit<ServiceSummary, "id"> & { id?: string }) | null {
  const name = cleanText(input.name, 80)
  if (!name) return null

  const duration = Number(input.duration_minutes)
  const parsedPrice = input.price === null || input.price === undefined || input.price === ""
    ? null
    : Number(input.price)

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : undefined,
    name,
    description: cleanText(input.description, 200),
    duration_minutes: Number.isSafeInteger(duration) && duration > 0 && duration <= 1440 ? duration : 30,
    price: parsedPrice !== null && Number.isSafeInteger(parsedPrice) && parsedPrice >= 0 ? parsedPrice : null,
    active: input.active === undefined ? true : Boolean(input.active),
  }
}

export function formatServices(services: Array<{ name: string; durationMinutes?: number | null; duration_minutes?: number | null; price?: number | null; active?: boolean }>) {
  return services
    .filter((service) => service.active !== false)
    .map((service) => {
      const duration = service.durationMinutes ?? service.duration_minutes
      const details = [
        duration ? `${duration} menit` : null,
        service.price !== null && service.price !== undefined ? formatRupiah(service.price) : null,
      ].filter(Boolean)
      return details.length > 0 ? `${service.name} (${details.join(", ")})` : service.name
    })
    .join(", ")
}

export function findMatchingService<T extends { name: string }>(services: T[], requested: string): T | null {
  const normalizedRequested = normalizeComparable(requested)
  if (!normalizedRequested) return null

  const requestedTokens = new Set(normalizedRequested.split(" ").filter(Boolean))
  return services.find((service) => {
    const normalizedName = normalizeComparable(service.name)
    const nameTokens = normalizedName.split(" ").filter(Boolean)
    return normalizedRequested === normalizedName ||
      normalizedRequested.includes(normalizedName) ||
      normalizedName.includes(normalizedRequested) ||
      nameTokens.some((token) => requestedTokens.has(token))
  }) || null
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}
