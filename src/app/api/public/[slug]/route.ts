import { prisma } from "@/lib/prisma"
import { estimateWaitMinutes, queueDateFor } from "@/lib/queue"
import { formatOperationalHours } from "@/lib/operational-hours"
import { formatServices } from "@/lib/services"
import { SLUG_PATTERN } from "@/lib/validation"

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const queueDate = queueDateFor()
  if (!SLUG_PATTERN.test(slug)) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      latitude: true,
      longitude: true,
      operationalHours: true,
      services: {
        where: { active: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, name: true, description: true, durationMinutes: true, price: true, active: true },
      },
      setupCompleted: true,
      _count: {
        select: {
          antrian: { where: { queueDate, status: { in: ["menunggu", "dipanggil"] } } },
        },
      },
    },
  })

  if (!tenant || !tenant.setupCompleted) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  const estimatedWait = await estimateWaitMinutes(tenant.id)

  return Response.json({
    name: tenant.name,
    slug: tenant.slug,
    description: tenant.description,
    latitude: tenant.latitude,
    longitude: tenant.longitude,
    operational_hours: formatOperationalHours(tenant.operationalHours),
    services: tenant.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      duration_minutes: service.durationMinutes,
      price: service.price,
    })),
    services_text: formatServices(tenant.services),
    active_queue_count: tenant._count.antrian,
    estimated_wait_min: estimatedWait,
  })
}
