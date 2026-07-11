import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ nomor: string }> }) {
  return withRequiredClaims(async ({ tenant_id }) => {
    const { nomor } = await params

    const history = await prisma.history.findMany({
      where: { tenantId: tenant_id, nomor },
      orderBy: { id: 'asc' },
      select: { id: true, nomor: true, role: true, content: true, toolCallId: true, toolName: true, toolCalls: true, createdAt: true },
    })

    return Response.json(history)
  })
}
