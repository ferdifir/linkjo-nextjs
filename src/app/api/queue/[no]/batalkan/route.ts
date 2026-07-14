import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'
import { parsePositiveInt } from '@/lib/validation'
import { queueDateFor } from '@/lib/queue'
import { auditEvent } from '@/lib/audit'

export async function PUT(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  return withRequiredClaims(async ({ tenant_id, user_id }) => {
    const queueDate = queueDateFor()
    const { no } = await params
    const noInt = parsePositiveInt(no)
    if (!noInt) {
      return Response.json({ error: 'nomor antrian tidak valid' }, { status: 400 })
    }

    const result = await prisma.antrian.updateMany({
      where: { tenantId: tenant_id, queueDate, noAntrian: noInt, status: { in: ['menunggu', 'dipanggil'] } },
      data: { status: 'batal' },
    })

    if (result.count === 0) {
      return Response.json({ message: `Nomor ${noInt} tidak dapat dibatalkan` }, { status: 404 })
    }

    await auditEvent({
      tenantId: tenant_id,
      actorType: "owner",
      actorIdentifier: user_id,
      action: "queue.cancel",
      resourceType: "queue",
      resourceId: noInt,
      metadata: { queue_date: queueDate.toISOString() },
    })
    return Response.json({ message: `Nomor ${noInt} dibatalkan` })
  })
}
