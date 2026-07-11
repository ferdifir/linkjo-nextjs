import { prisma } from "@/lib/prisma"
import { notifyQueueCreated } from "@/lib/notifications"
import { createQueueEntry } from "@/lib/queue"
import { normalizePhone, SLUG_PATTERN } from "@/lib/validation"
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/rate-limit"

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!SLUG_PATTERN.test(slug)) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, setupCompleted: true },
  })
  if (!tenant || !tenant.setupCompleted) {
    return Response.json({ error: "tenant tidak ditemukan" }, { status: 404 })
  }

  try {
    const body = await req.json()
    const ipLimit = await checkRateLimit({ key: `public-queue:ip:${tenant.id}:${clientIp(req)}`, limit: 20, windowMs: 60 * 60 * 1000 })
    if (!ipLimit.allowed) return rateLimitResponse(ipLimit.resetAt)
    const phone = normalizePhone(body.phone)
    if (phone) {
      const phoneLimit = await checkRateLimit({ key: `public-queue:phone:${tenant.id}:${phone}`, limit: 3, windowMs: 60 * 60 * 1000 })
      if (!phoneLimit.allowed) return rateLimitResponse(phoneLimit.resetAt)
    }

    const entry = await createQueueEntry(tenant.id, body)
    await notifyQueueCreated(tenant.id, entry.phone, entry.no, entry.estimated_wait_min)
    return Response.json(entry, { status: 201 })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "gagal membuat antrian" },
      { status: 400 },
    )
  }
}
