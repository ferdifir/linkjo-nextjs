import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'
import { notifyQueueCalled } from '@/lib/notifications'
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
      where: { tenantId: tenant_id, queueDate, noAntrian: noInt, status: 'menunggu' },
      data: { status: 'dipanggil' },
    })

    if (result.count === 0) {
      return Response.json({ message: `Nomor ${noInt} tidak dapat dipanggil` }, { status: 404 })
    }

    const antrian = await prisma.antrian.findFirst({
      where: { tenantId: tenant_id, queueDate, noAntrian: noInt },
      select: { phone: true },
    })

    await notifyQueueCalled(tenant_id, antrian?.phone ?? null, noInt)
    await auditEvent({
      tenantId: tenant_id,
      actorType: "owner",
      actorIdentifier: user_id,
      action: "queue.call",
      resourceType: "queue",
      resourceId: noInt,
      metadata: { queue_date: queueDate.toISOString() },
    })

    return Response.json({ message: `Nomor ${noInt} berhasil dipanggil` })
  })
}
