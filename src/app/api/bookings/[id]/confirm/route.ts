import { withRequiredClaims } from "@/lib/auth"
import { notifyBookingConfirmed } from "@/lib/notifications"
import { prisma } from "@/lib/prisma"
import { parsePositiveInt } from "@/lib/validation"
import { auditEvent } from "@/lib/audit"

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRequiredClaims(async ({ tenant_id, user_id }) => {
    const { id } = await params
    const bookingId = parsePositiveInt(id)
    if (!bookingId) {
      return Response.json({ error: "booking tidak valid" }, { status: 400 })
    }

    const result = await prisma.booking.updateMany({
      where: { id: BigInt(bookingId), tenantId: tenant_id, status: { not: "cancelled" } },
      data: { status: "confirmed" },
    })

    if (result.count === 0) {
      return Response.json({ error: "booking tidak ditemukan" }, { status: 404 })
    }

    const booking = await prisma.booking.findFirst({
      where: { id: BigInt(bookingId), tenantId: tenant_id },
      select: { id: true, phone: true, service: true, scheduledAt: true },
    })
    if (booking) {
      await notifyBookingConfirmed(tenant_id, booking.phone, {
        id: booking.id.toString(),
        service: booking.service,
        scheduled_at: booking.scheduledAt,
      })
      await auditEvent({
        tenantId: tenant_id,
        actorType: "owner",
        actorIdentifier: user_id,
        action: "booking.confirm",
        resourceType: "booking",
        resourceId: booking.id,
        metadata: { service: booking.service },
      })
    }

    return Response.json({ success: true })
  })
}
