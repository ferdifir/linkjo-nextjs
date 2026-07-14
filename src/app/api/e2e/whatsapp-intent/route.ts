import { prisma } from "@/lib/prisma"
import { e2eNotFound, isE2eRequestAllowed } from "@/lib/e2e"

export async function GET(req: Request) {
  if (!isE2eRequestAllowed(req)) return e2eNotFound()

  const url = new URL(req.url)
  const phone = url.searchParams.get("phone")
  if (!phone) {
    return Response.json({ error: "phone required" }, { status: 400 })
  }

  const intent = await prisma.whatsappIntent.findFirst({
    where: { phoneExpected: phone, purpose: "VERIFY_OWNER_PHONE" },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, consumedAt: true },
  })

  return Response.json({
    id: intent?.id || "",
    token: intent?.token || "",
    consumed: Boolean(intent?.consumedAt),
  })
}
