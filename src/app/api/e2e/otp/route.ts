import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  if (process.env.E2E_TEST_MODE !== "1") {
    return Response.json({ error: "not found" }, { status: 404 })
  }

  const url = new URL(req.url)
  const phone = url.searchParams.get("phone")
  if (!phone) {
    return Response.json({ error: "phone required" }, { status: 400 })
  }

  const otp = await prisma.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  })

  return Response.json({ code: otp?.code || "" })
}
