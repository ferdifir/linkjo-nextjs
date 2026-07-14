import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText, stepCountIs, tool, type ModelMessage } from "ai"
import { z } from "zod"
import { cancelBooking, createBooking, rescheduleBooking } from "@/lib/bookings"
import { formatOperationalHours } from "@/lib/operational-hours"
import { prisma } from "@/lib/prisma"
import { createQueueEntry, estimateWaitMinutes, queueDateFor } from "@/lib/queue"
import { findMatchingService, formatServices, resolveServiceMatch } from "@/lib/services"
import { buildTenantSystemPrompt, getGroqApiKey } from "@/lib/tenant-prompt"
import { cleanText } from "@/lib/validation"
import { logger, maskPhone, safeError } from "@/lib/logger"
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

type AgentInput = {
  tenant: TenantProfile
  phone: string
  message: string
}

const groq = createOpenAICompatible({
  name: "groq",
  apiKey: getGroqApiKey() || "missing",
  baseURL: "https://api.groq.com/openai/v1",
})

export async function answerWithWhatsappAgent(input: AgentInput) {
  if (!getGroqApiKey()) return fallbackFaq(input.tenant)

  const [state, history] = await Promise.all([
    getOrCreateConversationState(input.tenant.id, input.phone),
    recentHistory(input.tenant.id, input.phone),
  ])
  const messages = lastMessageMatches(history, input.message)
    ? history
    : [...history, { role: "user" as const, content: input.message }]

  try {
    const result = await generateText({
      model: groq.chatModel(process.env.GROQ_MODEL || "llama-3.1-8b-instant"),
      system: [
        buildTenantSystemPrompt(input.tenant),
        "",
        "Kamu adalah agent operasional WhatsApp. Gunakan tool untuk data dinamis dan aksi bisnis.",
        "Jangan mengarang status antrean, booking, layanan, harga, atau jam operasional.",
        "Untuk booking, reschedule, cancel booking, dan cancel antrean, minta konfirmasi dulu jika intent belum dikonfirmasi jelas.",
        "Input terbaru dari user mengalahkan state lama. Jika user berkata 'yang tadi', 'yang satunya', atau 'seperti kemarin' dan tidak jelas, tanyakan klarifikasi.",
        "Jawab singkat dalam bahasa Indonesia. Jangan sebut nama tool.",
        "",
        `State percakapan: ${summarizeState(state)}`,
      ].join("\n"),
      messages,
      tools: whatsappTools(input),
      stopWhen: stepCountIs(4),
      temperature: 0.2,
      maxOutputTokens: 350,
    })
    return cleanText(result.text, 1200) || fallbackFaq(input.tenant)
  } catch (error) {
    logger.error({
      event: "whatsapp.agent.failed",
      tenant_id: input.tenant.id,
      tenant_slug: input.tenant.slug,
      phone: maskPhone(input.phone),
      err: safeError(error),
    })
    return fallbackFaq(input.tenant)
  }
}

function whatsappTools(input: AgentInput) {
  const activeServices = input.tenant.services.filter((service) => service.active)

  return {
    listServices: tool({
      description: "Daftar layanan aktif beserta durasi dan harga.",
      inputSchema: z.object({}),
      execute: async () => ({
        services: activeServices.map((service) => ({
          id: service.id,
          name: service.name,
          durationMinutes: service.durationMinutes,
          price: service.price,
        })),
        text: formatServices(activeServices),
      }),
    }),
    getOperationalHours: tool({
      description: "Ambil jam operasional tenant.",
      inputSchema: z.object({}),
      execute: async () => ({
        operationalHours: formatOperationalHours(input.tenant.operationalHours) || "Jam operasional belum diatur.",
      }),
    }),
    checkQueueStatus: tool({
      description: "Cek antrean aktif nomor WhatsApp ini untuk hari berjalan.",
      inputSchema: z.object({}),
      execute: async () => {
        const latest = await prisma.antrian.findFirst({
          where: {
            tenantId: input.tenant.id,
            queueDate: queueDateFor(),
            phone: input.phone,
            status: { in: ["menunggu", "dipanggil"] },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, noAntrian: true, status: true },
        })
        if (!latest) return { found: false, message: "Tidak ada antrean aktif untuk nomor ini." }
        return {
          found: true,
          id: latest.id.toString(),
          no: latest.noAntrian,
          status: latest.status,
          estimatedWaitMin: await estimateWaitMinutes(input.tenant.id),
        }
      },
    }),
    joinQueue: tool({
      description: "Masukkan nomor WhatsApp ini ke antrean hari ini. Gunakan hanya jika user eksplisit ingin mengambil antrean.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Nama customer. Jika belum tahu, tanya dulu."),
      }),
      execute: async ({ name }) => {
        const entry = await createQueueEntry(input.tenant.id, { nama: name, phone: input.phone })
        await auditEvent({
          tenantId: input.tenant.id,
          actorType: "whatsapp",
          actorIdentifier: input.phone,
          action: "queue.create",
          resourceType: "queue",
          resourceId: entry.no,
          metadata: { source: "whatsapp_ai", queue_date: entry.queue_date },
        })
        return entry
      },
    }),
    cancelQueue: tool({
      description: "Batalkan antrean aktif nomor WhatsApp ini setelah user mengonfirmasi.",
      inputSchema: z.object({ confirmed: z.boolean() }),
      execute: async ({ confirmed }) => {
        if (!confirmed) return { cancelled: false, message: "Minta konfirmasi user sebelum membatalkan antrean." }
        const latest = await prisma.antrian.findFirst({
          where: { tenantId: input.tenant.id, queueDate: queueDateFor(), phone: input.phone, status: { in: ["menunggu", "dipanggil"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, noAntrian: true },
        })
        if (!latest) return { cancelled: false, message: "Tidak ada antrean aktif yang bisa dibatalkan." }
        await prisma.antrian.update({ where: { id: latest.id }, data: { status: "batal" } })
        await auditEvent({
          tenantId: input.tenant.id,
          actorType: "whatsapp",
          actorIdentifier: input.phone,
          action: "queue.cancel",
          resourceType: "queue",
          resourceId: latest.noAntrian,
          metadata: { source: "whatsapp_ai" },
        })
        return { cancelled: true, no: latest.noAntrian }
      },
    }),
    listActiveBookings: tool({
      description: "Daftar booking aktif nomor WhatsApp ini.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await prisma.booking.findMany({
          where: { tenantId: input.tenant.id, phone: input.phone, status: { not: "cancelled" } },
          orderBy: { scheduledAt: "asc" },
          take: 5,
          select: { id: true, service: true, scheduledAt: true, status: true, publicToken: true },
        })
        return rows.map((row) => ({
          id: row.id.toString(),
          service: row.service,
          scheduledAt: row.scheduledAt.toISOString(),
          status: row.status,
          publicToken: row.publicToken,
        }))
      },
    }),
    createBooking: tool({
      description: "Buat booking setelah user mengonfirmasi layanan, jadwal, dan nama.",
      inputSchema: z.object({
        serviceName: z.string().min(1),
        scheduledAt: z.string().min(1).describe("ISO datetime atau jadwal yang bisa diparse server."),
        customerName: z.string().min(1),
        notes: z.string().optional(),
        confirmed: z.boolean(),
      }),
      execute: async ({ serviceName, scheduledAt, customerName, notes, confirmed }) => {
        if (!confirmed) return { created: false, message: "Minta konfirmasi user sebelum membuat booking." }
        const serviceMatch = resolveServiceMatch(activeServices, serviceName)
        if (serviceMatch.status === "ambiguous") {
          return {
            created: false,
            message: `Ada beberapa layanan yang cocok: ${formatServices(serviceMatch.services)}. Minta user memilih nama layanan yang lebih spesifik.`,
          }
        }
        if (serviceMatch.status === "not_found") return { created: false, message: `Layanan tidak ditemukan. Pilihan: ${formatServices(activeServices)}` }
        const service = serviceMatch.service
        const booking = await createBooking(input.tenant.id, {
          customer_name: customerName,
          phone: input.phone,
          service_id: service.id,
          scheduled_at: scheduledAt,
          notes: notes || "Dibuat via WhatsApp AI",
        })
        await auditEvent({
          tenantId: input.tenant.id,
          actorType: "whatsapp",
          actorIdentifier: input.phone,
          action: "booking.create",
          resourceType: "booking",
          resourceId: booking.id,
          metadata: { source: "whatsapp_ai", service: booking.service, status: booking.status },
        })
        await updateConversationState(input.tenant.id, input.phone, {
          lastMentionedServiceId: service.id,
          lastBookingId: BigInt(booking.id),
          pendingIntent: null,
          pendingServiceId: null,
          pendingScheduledAt: null,
          pendingCustomerName: null,
        })
        return { created: true, booking }
      },
    }),
    rescheduleBooking: tool({
      description: "Jadwalkan ulang booking setelah user mengonfirmasi.",
      inputSchema: z.object({
        bookingId: z.number().int().positive(),
        publicToken: z.string().min(10),
        scheduledAt: z.string().min(1),
        confirmed: z.boolean(),
      }),
      execute: async ({ bookingId, publicToken, scheduledAt, confirmed }) => {
        if (!confirmed) return { rescheduled: false, message: "Minta konfirmasi user sebelum jadwal ulang booking." }
        const booking = await rescheduleBooking(input.tenant.id, BigInt(bookingId), {
          phone: input.phone,
          public_token: publicToken,
          scheduled_at: scheduledAt,
          notes: "Dijadwalkan ulang via WhatsApp AI",
        })
        await auditEvent({
          tenantId: input.tenant.id,
          actorType: "whatsapp",
          actorIdentifier: input.phone,
          action: "booking.reschedule",
          resourceType: "booking",
          resourceId: booking.id,
          metadata: { source: "whatsapp_ai", service: booking.service },
        })
        return { rescheduled: true, booking }
      },
    }),
    cancelBooking: tool({
      description: "Batalkan booking setelah user mengonfirmasi.",
      inputSchema: z.object({
        bookingId: z.number().int().positive(),
        publicToken: z.string().min(10),
        confirmed: z.boolean(),
      }),
      execute: async ({ bookingId, publicToken, confirmed }) => {
        if (!confirmed) return { cancelled: false, message: "Minta konfirmasi user sebelum membatalkan booking." }
        const booking = await cancelBooking(input.tenant.id, BigInt(bookingId), {
          phone: input.phone,
          public_token: publicToken,
        })
        await auditEvent({
          tenantId: input.tenant.id,
          actorType: "whatsapp",
          actorIdentifier: input.phone,
          action: "booking.cancel",
          resourceType: "booking",
          resourceId: booking.id,
          metadata: { source: "whatsapp_ai" },
        })
        return { cancelled: true, booking }
      },
    }),
    updateConversationState: tool({
      description: "Simpan state percakapan saat user memberi sebagian data booking/antrean.",
      inputSchema: z.object({
        pendingIntent: z.string().nullable().optional(),
        pendingServiceName: z.string().nullable().optional(),
        pendingScheduledAt: z.string().nullable().optional(),
        pendingCustomerName: z.string().nullable().optional(),
      }),
      execute: async ({ pendingIntent, pendingServiceName, pendingScheduledAt, pendingCustomerName }) => {
        const service = pendingServiceName ? findMatchingService(activeServices, pendingServiceName) : null
        await updateConversationState(input.tenant.id, input.phone, {
          pendingIntent: pendingIntent ?? undefined,
          pendingServiceId: pendingServiceName === null ? null : service?.id,
          pendingScheduledAt: pendingScheduledAt === null ? null : pendingScheduledAt ? new Date(pendingScheduledAt) : undefined,
          pendingCustomerName: pendingCustomerName ?? undefined,
          lastMentionedServiceId: service?.id,
        })
        return { saved: true }
      },
    }),
    clearPendingConversationState: tool({
      description: "Bersihkan state pending saat flow selesai atau dibatalkan.",
      inputSchema: z.object({}),
      execute: async () => {
        await updateConversationState(input.tenant.id, input.phone, {
          pendingIntent: null,
          pendingServiceId: null,
          pendingScheduledAt: null,
          pendingCustomerName: null,
          pendingBookingId: null,
          pendingBookingToken: null,
        })
        return { cleared: true }
      },
    }),
  }
}

async function getOrCreateConversationState(tenantId: string, phone: string) {
  return prisma.whatsappConversationState.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    create: { tenantId, phone },
    update: { lastInteractionAt: new Date() },
  })
}

async function updateConversationState(
  tenantId: string,
  phone: string,
  patch: {
    pendingIntent?: string | null
    pendingServiceId?: string | null
    pendingScheduledAt?: Date | null
    pendingCustomerName?: string | null
    pendingBookingId?: bigint | null
    pendingBookingToken?: string | null
    lastMentionedServiceId?: string | null
    lastBookingId?: bigint | null
    lastQueueId?: bigint | null
  },
) {
  const data = Object.fromEntries(
    Object.entries({ ...patch, lastInteractionAt: new Date() }).filter(([, value]) => value !== undefined),
  )
  await prisma.whatsappConversationState.upsert({
    where: { tenantId_phone: { tenantId, phone } },
    create: { tenantId, phone, ...data },
    update: data,
  })
}

async function recentHistory(tenantId: string, phone: string): Promise<ModelMessage[]> {
  const rows = await prisma.history.findMany({
    where: { tenantId, nomor: phone },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { role: true, content: true },
  })
  return rows.reverse().flatMap((row): ModelMessage[] => {
    const content = cleanText(row.content, 500)
    if (!content) return []
    return [{ role: row.role === "assistant" ? "assistant" : "user", content }]
  })
}

function summarizeState(state: Awaited<ReturnType<typeof getOrCreateConversationState>>) {
  return JSON.stringify({
    pendingIntent: state.pendingIntent,
    pendingServiceId: state.pendingServiceId,
    pendingScheduledAt: state.pendingScheduledAt?.toISOString() || null,
    pendingCustomerName: state.pendingCustomerName,
    lastMentionedServiceId: state.lastMentionedServiceId,
    lastBookingId: state.lastBookingId?.toString() || null,
    lastQueueId: state.lastQueueId?.toString() || null,
    lastInteractionAt: state.lastInteractionAt.toISOString(),
  })
}

function lastMessageMatches(history: ModelMessage[], message: string) {
  const last = history.at(-1)
  return last?.role === "user" && typeof last.content === "string" && last.content === cleanText(message, 500)
}

function fallbackFaq(tenant: TenantProfile) {
  const operationalHours = formatOperationalHours(tenant.operationalHours)
  return [
    `Saya asisten ${tenant.name}.`,
    operationalHours ? `Jam operasional: ${operationalHours}.` : null,
    formatServices(tenant.services) ? `Layanan: ${formatServices(tenant.services)}.` : null,
    "Ketik 'ambil antrian' untuk masuk antrian atau jelaskan layanan dan jadwal booking yang diinginkan.",
  ].filter(Boolean).join(" ")
}
