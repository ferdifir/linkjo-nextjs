export const DEFAULT_TEMPLATES: Record<string, string> = {
  queue_created: "Nomor antrian kamu #{no}. Estimasi tunggu sekitar {estimated_wait_min} menit. Kami akan kirim notifikasi saat giliranmu siap.",
  queue_called: "Halo! Giliran kamu nomor #{no} sudah siap. Silakan menuju ke tempat kami.",
  booking_created: "Booking #{booking_id} untuk {service} sudah masuk pada {scheduled_at}. Token kelola booking: {public_token}. Simpan token ini untuk jadwal ulang atau pembatalan.",
  booking_rescheduled: "Booking #{booking_id} untuk {service} dijadwalkan ulang ke {scheduled_at}.",
  booking_cancelled: "Booking #{booking_id} sudah dibatalkan.",
}

export const TEMPLATE_LABELS: Record<string, string> = {
  queue_created: "Antrian dibuat",
  queue_called: "Antrian dipanggil",
  booking_created: "Booking dibuat",
  booking_rescheduled: "Booking dijadwalkan ulang",
  booking_cancelled: "Booking dibatalkan",
}

export type MessageTemplate = {
  key: string
  value: string
}

export function defaultMessageTemplates(): MessageTemplate[] {
  return Object.entries(DEFAULT_TEMPLATES).map(([key, value]) => ({ key, value }))
}

export function templateVariables(template: string): string[] {
  return Array.from(new Set(template.match(/\{[a-zA-Z0-9_]+\}/g) || []))
}

export function requiredTemplateVariables(key: string): string[] {
  return templateVariables(DEFAULT_TEMPLATES[key] || "")
}

export function missingTemplateVariables(key: string, value: string): string[] {
  return requiredTemplateVariables(key).filter((variable) => !value.includes(variable))
}
