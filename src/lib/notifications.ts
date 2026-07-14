import { sendWA } from "@/lib/fonnte"
import { DEFAULT_TEMPLATES } from "@/lib/message-templates"
import { prisma } from "@/lib/prisma"

export async function notifyQueueCreated(tenantId: string, phone: string | null, no: number, estimatedWaitMin: number) {
  if (!phone) return
  await rememberWhatsappConversation(tenantId, phone)
  const message = await renderTemplate(tenantId, "queue_created", {
    no,
    estimated_wait_min: estimatedWaitMin,
  })
  await sendWA(phone, message)
}

export async function notifyQueueCalled(tenantId: string, phone: string | null, no: number) {
  if (!phone) return
  await rememberWhatsappConversation(tenantId, phone)
  const message = await renderTemplate(tenantId, "queue_called", { no })
  await sendWA(phone, message)
}

export async function notifyBookingCreated(
  tenantId: string,
  phone: string,
  booking: { id: string; public_token: string; service: string; scheduled_at: Date },
) {
  await rememberWhatsappConversation(tenantId, phone)
  const message = await renderTemplate(tenantId, "booking_created", bookingVariables(booking))
  await sendWA(phone, message)
}

export async function notifyBookingConfirmed(
  tenantId: string,
  phone: string,
  booking: { id: string; service: string; scheduled_at: Date },
) {
  await rememberWhatsappConversation(tenantId, phone)
  const message = await renderTemplate(tenantId, "booking_confirmed", bookingVariables(booking))
  await sendWA(phone, message)
}

export async function notifyBookingRescheduled(
  tenantId: string,
  phone: string,
  booking: { id: string; service: string; scheduled_at: Date },
) {
  await rememberWhatsappConversation(tenantId, phone)
  const message = await renderTemplate(tenantId, "booking_rescheduled", bookingVariables(booking))
  await sendWA(phone, message)
}

export async function notifyBookingCancelled(tenantId: string, phone: string, bookingId: string) {
  await rememberWhatsappConversation(tenantId, phone)
  const message = await renderTemplate(tenantId, "booking_cancelled", { booking_id: bookingId })
  await sendWA(phone, message)
}

export async function getTenantTemplates(tenantId: string) {
  const rows = await prisma.template.findMany({
    where: { tenantId },
    select: { key: true, value: true },
  })
  const overrides = new Map(rows.map((row) => [row.key, row.value]))
  return Object.entries(DEFAULT_TEMPLATES).map(([key, value]) => ({
    key,
    value: overrides.get(key) ?? value,
  }))
}

async function renderTemplate(tenantId: string, key: string, variables: Record<string, string | number>) {
  const template = await prisma.template.findUnique({
    where: { tenantId_key: { tenantId, key } },
    select: { value: true },
  })
  return applyTemplate(template?.value || DEFAULT_TEMPLATES[key] || "", variables)
}

export function applyTemplate(template: string, variables: Record<string, string | number>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = variables[key]
    return value === undefined ? match : String(value)
  })
}

function bookingVariables(booking: { id: string; public_token?: string; service?: string; scheduled_at?: Date }) {
  return {
    booking_id: booking.id,
    public_token: booking.public_token || "",
    service: booking.service || "",
    scheduled_at: booking.scheduled_at ? formatSchedule(booking.scheduled_at) : "",
  }
}

function formatSchedule(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

async function rememberWhatsappConversation(tenantId: string, phone: string) {
  await prisma.whatsappConversationState.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    create: { tenantId, phone, lastInteractionAt: new Date() },
    update: { lastInteractionAt: new Date() },
  })
}
