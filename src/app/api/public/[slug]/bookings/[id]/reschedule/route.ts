import { rescheduleBooking } from "@/lib/bookings"
import { prisma } from "@/lib/prisma"
import { notifyBookingRescheduled } from "@/lib/notifications"
import { normalizePhone, parsePositiveInt, SLUG_PATTERN } from "@/lib/validation"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"
import { auditEvent } from "@/lib/audit"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
) {
  const { slug, id } = await params
  const bookingId = parsePositiveInt(id)
  if (!SLUG_PATTERN.test(slug) || !bookingId) {
    return Response.json({ error: "booking tidak ditemukan" }, { status: 404 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, setupCompleted: true },
  })
  if (!tenant || !tenant.setupCompleted) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  try {
    const limit = await checkRateLimit({ key: `public-booking-manage:${tenant.id}:${clientIp(req)}`, limit: 30, windowMs: 60 * 60 * 1000 })
    if (!limit.allowed) return rateLimitResponse(limit.resetAt)
    const body = await req.json()
    if (!body.public_token) {
      return Response.json({ error: "token booking wajib diisi" }, { status: 400 })
    }
    if (!normalizePhone(body.phone)) {
      return Response.json({ error: "nomor WhatsApp wajib diisi" }, { status: 400 })
    }
    const booking = await rescheduleBooking(tenant.id, BigInt(bookingId), body)
    await notifyBookingRescheduled(tenant.id, booking.phone, booking)
    await auditEvent({
      tenantId: tenant.id,
      actorType: "customer",
      actorIdentifier: booking.phone,
      action: "booking.reschedule",
      resourceType: "booking",
      resourceId: booking.id,
      metadata: { source: "public", slug, status: booking.status },
    })
    return Response.json(booking)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "gagal menjadwalkan ulang booking" },
      { status: 400 },
    )
  }
}
