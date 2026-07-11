import { prisma } from '@/lib/prisma'
import { withRequiredClaims } from '@/lib/auth'

export async function GET() {
  return withRequiredClaims(async ({ tenant_id }) => {
    const now = new Date()

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(now.getTime() - 7 * 86400000)
  const monthAgo = new Date(now.getTime() - 30 * 86400000)

  const today = await prisma.antrian.groupBy({
    by: ['status'],
    where: { tenantId: tenant_id, createdAt: { gte: todayStart } },
    _count: true,
  })

  const weeklyTotal = await prisma.antrian.count({
    where: { tenantId: tenant_id, createdAt: { gte: weekAgo } },
  })

  const monthlyTotal = await prisma.antrian.count({
    where: { tenantId: tenant_id, createdAt: { gte: monthAgo } },
  })

  const avgWait = await prisma.$queryRaw<{ avg_wait_min: number | null }[]>`
    SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60) as avg_wait_min
    FROM antrian
    WHERE tenant_id = ${tenant_id}
      AND status IN ('dipanggil', 'selesai')
      AND created_at >= ${weekAgo}
  `

  const dailyTrend = await prisma.$queryRaw<{ date: string; count: bigint }[]>`
    SELECT DATE(created_at) as date, COUNT(*)::int as count
    FROM antrian
    WHERE tenant_id = ${tenant_id} AND created_at >= ${monthAgo}
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at)
  `

  const byStatus = await prisma.antrian.groupBy({
    by: ['status'],
    where: { tenantId: tenant_id },
    _count: true,
  })

  const totalAntrian = await prisma.antrian.count({
    where: { tenantId: tenant_id },
  })

  const antrianHariIni = await prisma.antrian.count({
    where: { tenantId: tenant_id, createdAt: { gte: todayStart } },
  })

  const statusMap = (list: { status: string; _count: number }[]) => {
    const m: Record<string, number> = { menunggu: 0, dipanggil: 0, selesai: 0, batal: 0 }
    for (const item of list) m[item.status] = item._count
    return ['menunggu', 'dipanggil', 'selesai', 'batal'].map(status => ({ status, count: m[status] }))
  }

    return Response.json({
      today: statusMap(today),
      weekly: { total: weeklyTotal, avg_wait_min: avgWait[0]?.avg_wait_min ?? 0 },
      monthly: monthlyTotal,
      daily_trend: dailyTrend.map(d => ({ date: d.date, count: Number(d.count) })),
      by_status: statusMap(byStatus),
      total_antrian: totalAntrian,
      antrian_hari_ini: antrianHariIni,
    })
  })
}
