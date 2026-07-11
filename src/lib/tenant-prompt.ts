import { formatOperationalHours } from "@/lib/operational-hours"
import { formatServices } from "@/lib/services"

type TenantPromptProfile = {
  name: string
  slug: string | null
  description: string
  operationalHours: string
  services: Array<{
    name: string
    durationMinutes?: number | null
    price?: number | null
    active?: boolean
  }>
}

export function getGroqApiKey(): string | null {
  return process.env.GROQ_API_KEY || null
}

export function buildTenantSystemPrompt(tenant: TenantPromptProfile): string {
  const publicUrl = tenant.slug ? `linkjo.co/${tenant.slug}` : "URL publik belum diatur"
  const operationalHours = formatOperationalHours(tenant.operationalHours) || "-"
  const services = formatServices(tenant.services) || "-"

  return [
    "Kamu adalah asisten antrian dan booking Linkjo.",
    "Jawab dengan bahasa Indonesia yang ringkas, ramah, dan operasional.",
    "Gunakan informasi bisnis berikut sebagai sumber kebenaran.",
    "",
    `Nama bisnis: ${tenant.name}`,
    `URL publik: ${publicUrl}`,
    `Deskripsi: ${tenant.description || "-"}`,
    `Jam operasional: ${operationalHours}`,
    `Layanan: ${services}`,
    "",
    "Bantu customer mengambil antrian, memahami layanan, dan membuat permintaan booking.",
    "Jika informasi tidak tersedia, jelaskan bahwa staf bisnis akan mengonfirmasi.",
  ].join("\n")
}
