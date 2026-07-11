import { prisma } from "@/lib/prisma"
import { cleanText, normalizePhone } from "@/lib/validation"

const DEFAULT_TIME_ZONE = "Asia/Jakarta"

export type QueueEntryResult = {
  no: number
  nama: string
  phone: string | null
  status: string
  estimated_wait_min: number
  queue_date: string
}

export function businessDateString(date = new Date(), timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) throw new Error("failed to calculate business date")
  return `${year}-${month}-${day}`
}

export function queueDateFor(date = new Date(), timeZone = DEFAULT_TIME_ZONE): Date {
  const [year, month, day] = businessDateString(date, timeZone).split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

export async function estimateWaitMinutes(tenantId: string): Promise<number> {
  const queueDate = queueDateFor()
  const weekAgo = new Date(Date.now() - 7 * 86400000)

  const [avgWait, waitingCount] = await Promise.all([
    prisma.$queryRaw<{ avg_wait_min: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 60) as avg_wait_min
      FROM antrian
      WHERE tenant_id = ${tenantId}
        AND status IN ('dipanggil', 'selesai')
        AND created_at >= ${weekAgo}
    `,
    prisma.antrian.count({
      where: { tenantId, queueDate, status: { in: ["menunggu", "dipanggil"] } },
    }),
  ])

  const averageServiceTime = Math.max(3, Math.round(avgWait[0]?.avg_wait_min ?? 8))
  return Math.max(0, waitingCount * averageServiceTime)
}

export async function createQueueEntry(
  tenantId: string,
  input: { nama: unknown; phone?: unknown },
): Promise<QueueEntryResult> {
  const nama = cleanText(input.nama, 80)
  const phone = input.phone === undefined ? null : normalizePhone(input.phone)
  const queueDate = queueDateFor()

  if (!nama) {
    throw new Error("nama pelanggan harus diisi")
  }

  if (input.phone !== undefined && !phone) {
    throw new Error("nomor WhatsApp tidak valid")
  }

  const entry = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:${businessDateString()}`}))`

    const max = await tx.antrian.findFirst({
      where: { tenantId, queueDate },
      orderBy: { noAntrian: "desc" },
      select: { noAntrian: true },
    })
    const nextNo = (max?.noAntrian ?? 0) + 1

    return tx.antrian.create({
      data: { tenantId, noAntrian: nextNo, queueDate, nama, phone },
      select: { noAntrian: true, nama: true, phone: true, status: true },
    })
  })

  const estimatedWait = await estimateWaitMinutes(tenantId)

  return {
    no: entry.noAntrian,
    nama: entry.nama,
    phone: entry.phone,
    status: entry.status,
    estimated_wait_min: estimatedWait,
    queue_date: businessDateString(),
  }
}
