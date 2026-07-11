import { prisma } from "@/lib/prisma"
import { cleanText, normalizePhone, parseScheduledAt } from "@/lib/validation"
import { randomBytes } from "crypto"
import { isWithinOperationalHours } from "@/lib/operational-hours"

export type BookingResult = {
  id: string
  public_token: string
  customer_name: string
  phone: string
  service: string
  scheduled_at: Date
  notes: string
  status: string
}

function serializeBooking(booking: {
  id: bigint
  publicToken: string
  customerName: string
  phone: string
  service: string
  scheduledAt: Date
  notes: string
  status: string
}): BookingResult {
  return {
    id: booking.id.toString(),
    public_token: booking.publicToken,
    customer_name: booking.customerName,
    phone: booking.phone,
    service: booking.service,
    scheduled_at: booking.scheduledAt,
    notes: booking.notes,
    status: booking.status,
  }
}

export async function createBooking(
  tenantId: string,
  input: {
    customer_name: unknown
    phone: unknown
    service_id?: unknown
    service?: unknown
    scheduled_at: unknown
    notes?: unknown
  },
): Promise<BookingResult> {
  const customerName = cleanText(input.customer_name, 80)
  const phone = normalizePhone(input.phone)
  const serviceId = cleanText(input.service_id, 100)
  const scheduledAt = parseScheduledAt(input.scheduled_at)
  const notes = cleanText(input.notes, 500)

  if (!customerName) throw new Error("nama pelanggan harus diisi")
  if (!phone) throw new Error("nomor WhatsApp tidak valid")
  if (!scheduledAt) throw new Error("jadwal booking tidak valid")
  await validateOperationalHours(tenantId, scheduledAt)

  const selectedService = serviceId
    ? await prisma.service.findFirst({
      where: { id: serviceId, tenantId, active: true },
      select: { id: true, name: true, durationMinutes: true },
    })
    : null
  const fallbackServiceName = cleanText(input.service, 120)
  if (!selectedService && !fallbackServiceName) throw new Error("layanan harus dipilih")
  if (serviceId && !selectedService) throw new Error("layanan tidak ditemukan")

  const booking = await prisma.booking.create({
    data: {
      tenantId,
      serviceId: selectedService?.id,
      publicToken: createPublicToken(),
      customerName,
      phone,
      service: selectedService?.name || fallbackServiceName,
      serviceDurationMinutes: selectedService?.durationMinutes || 30,
      scheduledAt,
      notes,
    },
    select: {
      id: true,
      publicToken: true,
      customerName: true,
      phone: true,
      service: true,
      scheduledAt: true,
      notes: true,
      status: true,
    },
  })

  return serializeBooking(booking)
}

export async function rescheduleBooking(
  tenantId: string,
  id: bigint,
  input: { scheduled_at: unknown; notes?: unknown; phone?: unknown; public_token?: unknown },
): Promise<BookingResult> {
  const scheduledAt = parseScheduledAt(input.scheduled_at)
  const notes = cleanText(input.notes, 500)
  const phone = input.phone === undefined ? null : normalizePhone(input.phone)
  const publicToken = cleanText(input.public_token, 100)
  if (!scheduledAt) throw new Error("jadwal booking tidak valid")
  if (input.phone !== undefined && !phone) throw new Error("nomor WhatsApp tidak valid")
  await validateOperationalHours(tenantId, scheduledAt)

  const result = await prisma.booking.updateMany({
    where: {
      id,
      tenantId,
      ...(phone ? { phone } : {}),
      ...(publicToken ? { publicToken } : {}),
      status: { not: "cancelled" },
    },
    data: { scheduledAt, notes, status: "pending" },
  })
  if (result.count === 0) throw new Error("booking tidak ditemukan")

  const booking = await prisma.booking.findFirstOrThrow({
    where: { id, tenantId },
    select: {
      id: true,
      publicToken: true,
      customerName: true,
      phone: true,
      service: true,
      scheduledAt: true,
      notes: true,
      status: true,
    },
  })

  return serializeBooking(booking)
}

export async function cancelBooking(
  tenantId: string,
  id: bigint,
  input?: { phone?: unknown; public_token?: unknown },
): Promise<BookingResult> {
  const phone = input?.phone === undefined ? null : normalizePhone(input.phone)
  const publicToken = cleanText(input?.public_token, 100)
  if (input?.phone !== undefined && !phone) throw new Error("nomor WhatsApp tidak valid")

  const result = await prisma.booking.updateMany({
    where: { id, tenantId, ...(phone ? { phone } : {}), ...(publicToken ? { publicToken } : {}) },
    data: { status: "cancelled" },
  })
  if (result.count === 0) throw new Error("booking tidak ditemukan")

  const booking = await prisma.booking.findFirstOrThrow({
    where: { id, tenantId },
    select: {
      id: true,
      publicToken: true,
      customerName: true,
      phone: true,
      service: true,
      scheduledAt: true,
      notes: true,
      status: true,
    },
  })

  return serializeBooking(booking)
}

function createPublicToken() {
  return randomBytes(24).toString("hex")
}

export async function validateOperationalHours(tenantId: string, scheduledAt: Date) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { operationalHours: true },
  })

  if (tenant?.operationalHours && !isWithinOperationalHours(scheduledAt, tenant.operationalHours)) {
    throw new Error("jadwal di luar jam operasional")
  }
}
