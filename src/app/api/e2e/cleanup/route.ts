import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  if (process.env.E2E_TEST_MODE !== "1") {
    return Response.json({ error: "not found" }, { status: 404 })
  }

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

  return Response.json({ success: true })
}
