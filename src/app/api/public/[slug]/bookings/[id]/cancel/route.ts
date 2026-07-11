import { cancelBooking } from "@/lib/bookings"
import { prisma } from "@/lib/prisma"
import { notifyBookingCancelled } from "@/lib/notifications"
import { normalizePhone, parsePositiveInt, SLUG_PATTERN } from "@/lib/validation"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
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
    const booking = await cancelBooking(tenant.id, BigInt(bookingId), body)
    await notifyBookingCancelled(tenant.id, booking.phone, booking.id)
    return Response.json(booking)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "gagal membatalkan booking" },
      { status: 400 },
    )
  }
}
