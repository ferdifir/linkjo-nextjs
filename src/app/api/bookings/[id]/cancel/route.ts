import { withRequiredClaims } from "@/lib/auth"
import { notifyBookingCancelled } from "@/lib/notifications"
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
      where: { id: BigInt(bookingId), tenantId: tenant_id },
      data: { status: "cancelled" },
    })

    if (result.count === 0) {
      return Response.json({ error: "booking tidak ditemukan" }, { status: 404 })
    }

    const booking = await prisma.booking.findFirst({
      where: { id: BigInt(bookingId), tenantId: tenant_id },
      select: { id: true, phone: true },
    })
    if (booking) {
      await notifyBookingCancelled(tenant_id, booking.phone, booking.id.toString())
      await auditEvent({
        tenantId: tenant_id,
        actorType: "owner",
        actorIdentifier: user_id,
        action: "booking.cancel",
        resourceType: "booking",
        resourceId: booking.id,
        metadata: { source: "owner" },
      })
    }

    return Response.json({ success: true })
  })
}
