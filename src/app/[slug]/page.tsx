import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { estimateWaitMinutes, queueDateFor } from "@/lib/queue"
import { SLUG_PATTERN } from "@/lib/validation"
import { formatOperationalHours } from "@/lib/operational-hours"
import { formatServices } from "@/lib/services"
import { publicTenantUrl } from "@/lib/public-url"
import PublicTenantClient from "./public-tenant-client"

export default async function PublicTenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_PATTERN.test(slug)) notFound()

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
    },
  })

  if (!tenant || !tenant.setupCompleted || !tenant.slug) notFound()

  const queueDate = queueDateFor()
  const [estimatedWait, activeQueueCount] = await Promise.all([
    estimateWaitMinutes(tenant.id),
    prisma.antrian.count({
      where: { tenantId: tenant.id, queueDate, status: { in: ["menunggu", "dipanggil"] } },
    }),
  ])
  const publicUrl = publicTenantUrl(tenant.slug)

  return (
    <PublicTenantClient
      tenant={{
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
        active_queue_count: activeQueueCount,
        estimated_wait_min: estimatedWait,
        public_url: publicUrl,
      }}
    />
  )
}
