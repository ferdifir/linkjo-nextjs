import { cancelBooking, createBooking, rescheduleBooking } from "@/lib/bookings"
import { sendWA } from "@/lib/fonnte"
import { createQueueEntry, estimateWaitMinutes, queueDateFor } from "@/lib/queue"
import { cleanText, normalizePhone } from "@/lib/validation"
import { prisma } from "@/lib/prisma"
import { formatServices, resolveServiceMatch } from "@/lib/services"
import { answerWithWhatsappAgent } from "@/lib/whatsapp-agent"
import { auditEvent } from "@/lib/audit"

type TenantProfile = {
  id: string
  name: string
  slug: string | null
  description: string
  operationalHours: string
  services: Array<{
    id: string
    name: string
    durationMinutes: number
    price: number | null
    active: boolean
  }>
}

export async function handleInboundCustomerMessage(input: {
  tenant: TenantProfile
  from: string
  message: string
}) {
  const phone = normalizePhone(input.from)
  const message = cleanText(input.message, 1000)
  if (!phone || !message) {
    return { reply: "Nomor WhatsApp atau pesan tidak valid." }
  }

  await writeHistory(input.tenant.id, phone, "user", message)

  const actionReply = await tryBusinessAction(input.tenant, phone, message)
  const reply = actionReply ?? await answerWithWhatsappAgent({ tenant: input.tenant, phone, message })

  await writeHistory(input.tenant.id, phone, "assistant", reply)
  await sendWA(phone, reply)
  return { reply }
}

async function tryBusinessAction(tenant: TenantProfile, phone: string, message: string) {
  const lower = message.toLowerCase()

  if (/\b(antrian|ambil nomor|daftar antre|daftar antri|queue)\b/.test(lower)) {
    const name = extractName(message) || phone
    const entry = await createQueueEntry(tenant.id, { nama: name, phone })
    await auditEvent({
      tenantId: tenant.id,
      actorType: "whatsapp",
      actorIdentifier: phone,
      action: "queue.create",
      resourceType: "queue",
      resourceId: entry.no,
      metadata: { source: "whatsapp", queue_date: entry.queue_date },
    })
    return `Kamu sudah masuk antrian #${entry.no}. Estimasi tunggu sekitar ${entry.estimated_wait_min} menit. Kami akan beri tahu saat giliranmu siap.`
  }

  if (/\b(cek|status|nomor saya)\b/.test(lower)) {
    const latest = await prisma.antrian.findFirst({
      where: { tenantId: tenant.id, queueDate: queueDateFor(), phone, status: { in: ["menunggu", "dipanggil"] } },
      orderBy: { createdAt: "desc" },
      select: { noAntrian: true, status: true },
    })
    if (!latest) {
      return "Saya belum menemukan antrian aktif untuk nomor WhatsApp ini. Ketik 'ambil antrian' untuk masuk antrian."
    }
    const estimatedWait = await estimateWaitMinutes(tenant.id)
    return `Antrian aktif kamu #${latest.noAntrian}, status ${latest.status}. Estimasi tunggu sekitar ${estimatedWait} menit.`
  }

  if (/\b(batal|cancel)\b/.test(lower) && /\b(antrian|antrean|queue)\b/.test(lower)) {
    const latest = await prisma.antrian.findFirst({
      where: { tenantId: tenant.id, queueDate: queueDateFor(), phone, status: { in: ["menunggu", "dipanggil"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, noAntrian: true },
    })
    if (!latest) return "Tidak ada antrian aktif yang bisa dibatalkan untuk nomor ini."
    await prisma.antrian.update({ where: { id: latest.id }, data: { status: "batal" } })
    await auditEvent({
      tenantId: tenant.id,
      actorType: "whatsapp",
      actorIdentifier: phone,
      action: "queue.cancel",
      resourceType: "queue",
      resourceId: latest.noAntrian,
      metadata: { source: "whatsapp" },
    })
    return `Antrian #${latest.noAntrian} sudah dibatalkan.`
  }

  if (/\b(reschedule|jadwal ulang)\b/.test(lower)) {
    const parsed = parseManageBookingMessage(message)
    if (!parsed) {
      return "Untuk jadwal ulang via WhatsApp, kirim: reschedule <nomor-booking> <token> <YYYY-MM-DD> <HH:mm>."
    }
    const booking = await rescheduleBooking(tenant.id, BigInt(parsed.id), {
      phone,
      public_token: parsed.token,
      scheduled_at: parsed.scheduledAt,
      notes: "Dijadwalkan ulang via WhatsApp",
    })
    await auditEvent({
      tenantId: tenant.id,
      actorType: "whatsapp",
      actorIdentifier: phone,
      action: "booking.reschedule",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: { source: "whatsapp", service: booking.service },
    })
    return `Booking #${booking.id} dijadwalkan ulang ke ${formatSchedule(booking.scheduled_at)}.`
  }

  if (/\b(batal|cancel)\b/.test(lower) && /\b(booking|reservasi)\b/.test(lower)) {
    const parsed = parseCancelBookingMessage(message)
    if (!parsed) return "Untuk batal booking via WhatsApp, kirim: batal booking <nomor-booking> <token>."
    const booking = await cancelBooking(tenant.id, BigInt(parsed.id), { phone, public_token: parsed.token })
    await auditEvent({
      tenantId: tenant.id,
      actorType: "whatsapp",
      actorIdentifier: phone,
      action: "booking.cancel",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: { source: "whatsapp" },
    })
    return `Booking #${booking.id} sudah dibatalkan.`
  }

  if (/\b(booking|reservasi|jadwal)\b/.test(lower)) {
    const parsed = parseBookingMessage(message)
    if (!parsed) {
      return "Untuk booking, kirim format: booking <layanan> <YYYY-MM-DD> <HH:mm>. Contoh: booking haircut 2026-07-20 14:30."
    }
    const activeServices = tenant.services.filter((item) => item.active)
    const serviceMatch = resolveServiceMatch(activeServices, parsed.service)
    if (serviceMatch.status === "ambiguous") {
      return `Saya menemukan beberapa layanan yang mirip: ${formatServices(serviceMatch.services)}. Mohon tulis nama layanan yang lebih spesifik.`
    }
    if (serviceMatch.status === "not_found") {
      const serviceList = formatServices(tenant.services)
      return serviceList
        ? `Layanan tidak ditemukan. Pilih salah satu: ${serviceList}.`
        : "Belum ada layanan aktif untuk booking. Silakan hubungi staf bisnis."
    }
    const service = serviceMatch.service

    const booking = await createBooking(tenant.id, {
      customer_name: phone,
      phone,
      service_id: service.id,
      scheduled_at: parsed.scheduledAt,
      notes: "Dibuat via WhatsApp",
    })
    await auditEvent({
      tenantId: tenant.id,
      actorType: "whatsapp",
      actorIdentifier: phone,
      action: "booking.create",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: { source: "whatsapp", service: booking.service, status: booking.status },
    })
    return `Booking #${booking.id} untuk ${booking.service} sudah dibuat pada ${formatSchedule(booking.scheduled_at)}. Token kelola booking: ${booking.public_token}.`
  }

  return null
}

function extractName(message: string) {
  const match = message.match(/\bnama\s+(?:saya\s+)?([a-zA-Z\s.'-]{2,60})/i)
  return match ? cleanText(match[1], 80) : ""
}

function parseBookingMessage(message: string) {
  const match = message.match(/\bbooking\s+(.+?)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\b/i)
  if (!match) return null
  const scheduledAt = new Date(`${match[2]}T${match[3]}:00+07:00`)
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) return null
  return { service: cleanText(match[1], 120), scheduledAt: scheduledAt.toISOString() }
}

function parseManageBookingMessage(message: string) {
  const match = message.match(/\b(?:reschedule|jadwal ulang)\s+(\d+)\s+([a-f0-9]{32,80})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\b/i)
  if (!match) return null
  const scheduledAt = new Date(`${match[3]}T${match[4]}:00+07:00`)
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) return null
  return { id: Number(match[1]), token: match[2], scheduledAt: scheduledAt.toISOString() }
}

function parseCancelBookingMessage(message: string) {
  const match = message.match(/\b(?:batal|cancel)\s+booking\s+(\d+)\s+([a-f0-9]{32,80})\b/i)
  if (!match) return null
  return { id: Number(match[1]), token: match[2] }
}

async function writeHistory(tenantId: string, nomor: string, role: string, content: string) {
  await prisma.history.create({
    data: { tenantId, nomor, role, content },
  })
}

function formatSchedule(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}
