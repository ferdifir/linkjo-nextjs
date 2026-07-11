import { withRequiredClaims } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  return withRequiredClaims(async ({ tenant_id }) => {
    const bookings = await prisma.booking.findMany({
      where: { tenantId: tenant_id, status: { not: "cancelled" } },
      orderBy: { scheduledAt: "asc" },
      take: 100,
      select: {
        id: true,
        customerName: true,
        phone: true,
        service: true,
        serviceDurationMinutes: true,
        scheduledAt: true,
        notes: true,
        status: true,
        createdAt: true,
      },
    })

    return Response.json(bookings.map((booking) => ({
      id: booking.id.toString(),
      customer_name: booking.customerName,
      phone: booking.phone,
      service: booking.service,
      service_duration_minutes: booking.serviceDurationMinutes,
      scheduled_at: booking.scheduledAt,
      notes: booking.notes,
      status: booking.status,
      created_at: booking.createdAt,
    })))
  })
}
