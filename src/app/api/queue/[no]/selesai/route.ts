import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'
import { parsePositiveInt } from '@/lib/validation'
import { queueDateFor } from '@/lib/queue'

export async function PUT(_req: Request, { params }: { params: Promise<{ no: string }> }) {
  return withRequiredClaims(async ({ tenant_id }) => {
    const queueDate = queueDateFor()
    const { no } = await params
    const noInt = parsePositiveInt(no)
    if (!noInt) {
      return Response.json({ error: 'nomor antrian tidak valid' }, { status: 400 })
    }

    const result = await prisma.antrian.updateMany({
      where: { tenantId: tenant_id, queueDate, noAntrian: noInt, status: { in: ['menunggu', 'dipanggil'] } },
      data: { status: 'selesai' },
    })

    if (result.count === 0) {
      return Response.json({ message: `Nomor ${noInt} tidak ditemukan atau sudah selesai/batal` }, { status: 404 })
    }

    return Response.json({ message: `Nomor ${noInt} selesai` })
  })
}
