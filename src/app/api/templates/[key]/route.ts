import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'
import { DEFAULT_TEMPLATES } from '@/lib/notifications'

export async function PUT(req: Request, { params }: { params: Promise<{ key: string }> }) {
  return withRequiredClaims(async ({ tenant_id }) => {
    const { key } = await params
    if (!DEFAULT_TEMPLATES[key]) {
      return Response.json({ error: 'template tidak dikenal' }, { status: 400 })
    }
    const { value } = await req.json()
    if (typeof value !== 'string' || value.length > 1000) {
      return Response.json({ error: 'template tidak valid' }, { status: 400 })
    }

    await prisma.template.upsert({
      where: { tenantId_key: { tenantId: tenant_id, key } },
      update: { value },
      create: { tenantId: tenant_id, key, value },
    })

    return Response.json({ key, value })
  })
}
