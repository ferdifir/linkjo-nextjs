import { prisma } from "@/lib/prisma"
import { e2eNotFound, isE2eRequestAllowed } from "@/lib/e2e"

export async function POST(req: Request) {
  if (!isE2eRequestAllowed(req)) return e2eNotFound()

  const { phone, slug } = await req.json()
  if (typeof phone !== "string" || typeof slug !== "string") {
    return Response.json({ error: "phone and slug required" }, { status: 400 })
  }

  const [user, tenant] = await Promise.all([
    prisma.user.findUnique({ where: { phone }, select: { tenantId: true } }),
    prisma.tenant.findUnique({ where: { slug }, select: { id: true } }),
  ])

  const tenantIds = Array.from(new Set([user?.tenantId, tenant?.id].filter((id): id is string => Boolean(id))))
  await Promise.all(tenantIds.map((id) => prisma.tenant.delete({ where: { id } })))
  await prisma.otpCode.deleteMany({ where: { phone } })
  await prisma.whatsappIntent.deleteMany({ where: { phoneExpected: phone } })
  await prisma.whatsappConversationState.deleteMany({ where: { phone } })

  return Response.json({ success: true })
}
