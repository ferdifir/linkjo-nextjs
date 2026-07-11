import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'
import { DEFAULT_TEMPLATES } from '@/lib/notifications'

export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  return withRequiredClaims(async ({ tenant_id }) => {
    const { key } = await params
    const value = DEFAULT_TEMPLATES[key]
    if (!value) {
      return Response.json({ error: 'template tidak dikenal' }, { status: 400 })
    }

    await prisma.template.upsert({
      where: { tenantId_key: { tenantId: tenant_id, key } },
      update: { value },
      create: { tenantId: tenant_id, key, value },
    })

    return Response.json({ key, message: 'reset' })
  })
}
