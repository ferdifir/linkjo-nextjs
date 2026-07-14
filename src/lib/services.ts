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
  const match = resolveServiceMatch(services, requested)
  return match.status === "matched" ? match.service : null
}

export type ServiceMatchResult<T> =
  | { status: "matched"; service: T }
  | { status: "ambiguous"; services: T[] }
  | { status: "not_found" }

export function resolveServiceMatch<T extends { name: string }>(services: T[], requested: string): ServiceMatchResult<T> {
  const normalizedRequested = normalizeComparable(requested)
  const requestedTokens = tokenSet(normalizedRequested)
  if (!normalizedRequested || requestedTokens.size === 0) return { status: "not_found" }

  const candidates = services
    .map((service) => ({
      service,
      normalizedName: normalizeComparable(service.name),
    }))
    .map((candidate) => ({
      ...candidate,
      score: serviceMatchScore(normalizedRequested, requestedTokens, candidate.normalizedName),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || b.normalizedName.length - a.normalizedName.length)

  if (candidates.length === 0) return { status: "not_found" }

  const [best, second] = candidates
  if (second && second.score === best.score) {
    return {
      status: "ambiguous",
      services: candidates.filter((candidate) => candidate.score === best.score).map((candidate) => candidate.service),
    }
  }

  return { status: "matched", service: best.service }
}

function normalizeComparable(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

const SERVICE_STOP_WORDS = new Set([
  "booking",
  "reservasi",
  "jadwal",
  "layanan",
  "service",
  "untuk",
  "mau",
  "ingin",
  "saya",
  "tolong",
])

function tokenSet(value: string) {
  return new Set(value.split(" ").filter((token) => token && !SERVICE_STOP_WORDS.has(token)))
}

function serviceMatchScore(normalizedRequested: string, requestedTokens: Set<string>, normalizedName: string) {
  if (!normalizedName) return 0
  const nameTokens = tokenSet(normalizedName)
  if (nameTokens.size === 0) return 0

  if (normalizedRequested === normalizedName) return 1000
  if (normalizedRequested.includes(normalizedName)) return 800 + nameTokens.size
  if (normalizedName.includes(normalizedRequested)) return 700 + requestedTokens.size

  const common = Array.from(nameTokens).filter((token) => requestedTokens.has(token)).length
  if (common === 0) return 0

  return common * 100 +
    (common / requestedTokens.size) * 10 +
    (common / nameTokens.size) * 10
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}
