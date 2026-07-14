import { prisma } from "@/lib/prisma"
import { e2eNotFound, isE2eRequestAllowed } from "@/lib/e2e"

export async function GET(req: Request) {
  if (!isE2eRequestAllowed(req)) return e2eNotFound()

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
