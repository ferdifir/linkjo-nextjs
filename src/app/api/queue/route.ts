import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'
import { createQueueEntry, queueDateFor } from '@/lib/queue'

export async function GET() {
  return withRequiredClaims(async ({ tenant_id }) => {
    const queueDate = queueDateFor()
    const queue = await prisma.antrian.findMany({
      where: { tenantId: tenant_id, queueDate, status: { in: ['menunggu', 'dipanggil'] } },
      orderBy: { noAntrian: 'asc' },
      select: { noAntrian: true, nama: true, phone: true, status: true, createdAt: true },
    })
    return Response.json(queue.map(q => ({
      no: q.noAntrian,
      nama: q.nama,
      phone: q.phone,
      status: q.status,
      created_at: q.createdAt,
    })))
  })
}

export async function POST(req: Request) {
  return withRequiredClaims(async ({ tenant_id }) => {
    const body = await req.json()

    try {
      const entry = await createQueueEntry(tenant_id, body, { allowWalkIn: true })
      return Response.json(entry, { status: 201 })
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'gagal membuat antrian' },
        { status: 400 },
      )
    }
  })
}
