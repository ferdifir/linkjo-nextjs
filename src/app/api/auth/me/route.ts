import { prisma } from '@/lib/prisma'
import { getClaims } from '@/lib/auth'

export async function GET() {
  const claims = await getClaims()
  if (!claims) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({ where: { id: claims.user_id }, include: { tenant: true } })
  if (!user) {
    return Response.json({ error: 'User not found' }, { status: 401 })
  }

  return Response.json({
    user: {
      id: user.id,
      phone: user.phone,
      email: user.email,
      username: user.username || '',
      name: user.name,
      tenant_id: user.tenantId,
      setup_completed: user.tenant.setupCompleted,
    },
  })
}
