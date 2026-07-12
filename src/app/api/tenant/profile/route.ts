import { prisma } from '@/lib/prisma'
import { getClaims } from '@/lib/auth'
import { normalizeServiceInputs } from '@/lib/services'
import { normalizeOperationalHoursConfig } from '@/lib/operational-hours'
import { displayName } from '@/lib/display-name'

export async function GET() {
  const claims = await getClaims()
  if (!claims) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: claims.tenant_id },
    select: {
      name: true,
      slug: true,
      description: true,
      latitude: true,
      longitude: true,
      operationalHours: true,
      setupCompleted: true,
      services: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, description: true, durationMinutes: true, price: true, active: true },
      },
    },
  })

  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 })
  }

    return Response.json({
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
      owner_name: await getTenantOwnerName(claims.user_id),
      latitude: tenant.latitude,
      longitude: tenant.longitude,
      operational_hours: tenant.operationalHours,
    services: tenant.services.map(serializeService),
    setup_completed: tenant.setupCompleted,
  })
}

export async function PUT(req: Request) {
  const claims = await getClaims()
  if (!claims) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, owner_name, description, latitude, longitude, operational_hours, services } = await req.json()

  if (!name?.trim()) {
    return Response.json({ error: 'nama bisnis harus diisi' }, { status: 400 })
  }
  if (!owner_name?.trim()) {
    return Response.json({ error: 'nama akun harus diisi' }, { status: 400 })
  }

  const normalizedServices = normalizeServiceInputs(services)
  if (normalizedServices.length === 0) {
    return Response.json({ error: 'minimal satu layanan harus diisi' }, { status: 400 })
  }
  const location = normalizeLocation(latitude, longitude)
  if (location.error) {
    return Response.json({ error: location.error }, { status: 400 })
  }

  let operationalHours = ''
  try {
    operationalHours = normalizeOperationalHoursConfig(operational_hours)
  } catch {
    return Response.json({ error: 'jam operasional tidak valid' }, { status: 400 })
  }

  const tenant = await prisma.$transaction(async (tx) => {
    const updatedTenant = await tx.tenant.update({
      where: { id: claims.tenant_id },
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        latitude: location.latitude,
        longitude: location.longitude,
        operationalHours,
        setupCompleted: true,
      },
      select: {
        name: true,
        slug: true,
        description: true,
        latitude: true,
        longitude: true,
        operationalHours: true,
        setupCompleted: true,
      },
    })

    const existingServices = await tx.service.findMany({
      where: { tenantId: claims.tenant_id },
      select: { id: true },
    })
    const existingIds = new Set(existingServices.map((service) => service.id))
    const submittedExistingIds = new Set(normalizedServices
      .map((service) => service.id)
      .filter((id): id is string => Boolean(id && existingIds.has(id))))

    await tx.service.deleteMany({
      where: {
        tenantId: claims.tenant_id,
        id: { notIn: Array.from(submittedExistingIds) },
      },
    })

    await Promise.all(normalizedServices.map((service, index) => {
      const data = {
        name: service.name,
        description: service.description,
        durationMinutes: service.duration_minutes,
        price: service.price,
        active: service.active,
        sortOrder: index,
      }

      if (service.id && existingIds.has(service.id)) {
        return tx.service.update({
          where: { id: service.id },
          data,
        })
      }

      return tx.service.create({
        data: {
          tenantId: claims.tenant_id,
          ...data,
        },
      })
    }))

    await tx.user.update({
      where: { id: claims.user_id },
      data: { name: owner_name.trim() },
    })

    const updatedServices = await tx.service.findMany({
      where: { tenantId: claims.tenant_id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, description: true, durationMinutes: true, price: true, active: true },
    })

    return { ...updatedTenant, services: updatedServices }
  })

  return Response.json({
    name: tenant.name,
    slug: tenant.slug,
    description: tenant.description,
    owner_name: await getTenantOwnerName(claims.user_id),
    latitude: tenant.latitude,
    longitude: tenant.longitude,
    operational_hours: tenant.operationalHours,
    services: tenant.services.map(serializeService),
    setup_completed: tenant.setupCompleted,
  })
}

async function getTenantOwnerName(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, phone: true },
  })
  return displayName(user?.name || "", user?.phone || "")
}

function normalizeLocation(latitude: unknown, longitude: unknown): { latitude: number | null; longitude: number | null; error?: string } {
  const lat = latitude === null || latitude === undefined || latitude === '' ? null : Number(latitude)
  const lng = longitude === null || longitude === undefined || longitude === '' ? null : Number(longitude)

  if (lat === null && lng === null) return { latitude: null, longitude: null }
  if (lat === null || lng === null) return { latitude: null, longitude: null, error: 'latitude dan longitude harus lengkap' }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { latitude: null, longitude: null, error: 'latitude tidak valid' }
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { latitude: null, longitude: null, error: 'longitude tidak valid' }
  }
  return { latitude: lat, longitude: lng }
}

function serializeService(service: {
  id: string
  name: string
  description: string
  durationMinutes: number
  price: number | null
  active: boolean
}) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    duration_minutes: service.durationMinutes,
    price: service.price,
    active: service.active,
  }
}
