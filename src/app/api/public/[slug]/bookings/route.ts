import { createBooking } from "@/lib/bookings"
import { prisma } from "@/lib/prisma"
import { notifyBookingCreated } from "@/lib/notifications"
import { normalizePhone, SLUG_PATTERN } from "@/lib/validation"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_PATTERN.test(slug)) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, setupCompleted: true },
  })
  if (!tenant || !tenant.setupCompleted) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  try {
    const body = await req.json()
    const ipLimit = await checkRateLimit({ key: `public-booking:ip:${tenant.id}:${clientIp(req)}`, limit: 20, windowMs: 60 * 60 * 1000 })
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.resetAt)
    const phone = normalizePhone(body.phone)
    if (phone) {
      const phoneLimit = await checkRateLimit({ key: `public-booking:phone:${tenant.id}:${phone}`, limit: 6, windowMs: 24 * 60 * 60 * 1000 })
      if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.resetAt)
    }

    const booking = await createBooking(tenant.id, body)
    await notifyBookingCreated(tenant.id, booking.phone, booking)
    return Response.json(booking, { status: 201 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "gagal membuat booking" },
      { status: 400 },
    )
  }
}
