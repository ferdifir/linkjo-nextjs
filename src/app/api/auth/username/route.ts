import { prisma } from "@/lib/prisma"
import { signToken, setTokenCookie, withRequiredClaims } from "@/lib/auth"
import { validateSlug } from "@/lib/validation"
import { displayName } from "@/lib/display-name"

export async function POST(req: Request) {
  return withRequiredClaims(async (claims) => {
    const payload = await req.json()
    const { slug: username, error } = validateSlug(payload.username)
    if (error) {
      return Response.json({ error }, { status: 400 })
    }

    const [userExists, tenantExists] = await Promise.all([
      prisma.user.count({
        where: { username, id: { not: claims.user_id } },
      }),
      prisma.tenant.count({
        where: { slug: username, id: { not: claims.tenant_id } },
      }),
    ])
    if (userExists > 0 || tenantExists > 0) {
      return Response.json({ error: "username sudah dipakai" }, { status: 409 })
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: claims.user_id, username: null },
    })
    if (!targetUser) {
      return Response.json({ error: "username already set" }, { status: 409 })
    }

    await prisma.user.update({
      where: { id: claims.user_id },
      data: { username },
    })
    await prisma.tenant.update({
      where: { id: claims.tenant_id },
      data: { slug: username },
    })

    const user = await prisma.user.findUniqueOrThrow({ where: { id: claims.user_id }, include: { tenant: true } })
    const token = await signToken({ user_id: user.id, tenant_id: user.tenantId, phone: user.phone })

    const body = {
      token,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        username: user.username || "",
        name: displayName(user.name, user.phone),
        tenant_id: user.tenantId,
        setup_completed: user.tenant.setupCompleted,
      },
      needs_setup: false,
    }

    const res = Response.json(body)
    setTokenCookie(res, token)
    return res
  })
}
