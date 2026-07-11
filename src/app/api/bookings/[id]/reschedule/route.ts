import { withRequiredClaims } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsePositiveInt, parseScheduledAt } from "@/lib/validation"
import { validateOperationalHours } from "@/lib/bookings"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRequiredClaims(async ({ tenant_id }) => {
    const { id } = await params
    const bookingId = parsePositiveInt(id)
    if (!bookingId) {
      return Response.json({ error: "booking tidak valid" }, { status: 400 })
    }

    const { scheduled_at } = await req.json()
    const scheduledAt = parseScheduledAt(scheduled_at)
    if (!scheduledAt) {
      return Response.json({ error: "jadwal booking tidak valid" }, { status: 400 })
    }

    try {
      await validateOperationalHours(tenant_id, scheduledAt)
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : "jadwal booking tidak valid" }, { status: 400 })
    }

    const existing = await prisma.booking.findFirst({
      where: { id: BigInt(bookingId), tenantId: tenant_id, status: { not: "cancelled" } },
      select: { status: true },
    })
    if (!existing) {
      return Response.json({ error: "booking tidak ditemukan" }, { status: 404 })
    }

    await prisma.booking.update({
      where: { id: BigInt(bookingId) },
      data: { scheduledAt, status: existing.status },
    })

    return Response.json({ success: true })
  })
}
