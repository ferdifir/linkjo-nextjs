import { withRequiredClaims } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parsePositiveInt } from "@/lib/validation"

export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withRequiredClaims(async ({ tenant_id }) => {
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

    return Response.json({ success: true })
  })
}
