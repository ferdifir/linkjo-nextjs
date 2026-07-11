import { prisma } from "@/lib/prisma"
import { validateSlug } from "@/lib/validation"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const { slug, error } = validateSlug(searchParams.get("slug"))

  if (error) {
    return Response.json(
      { available: false, error },
      { status: 400 },
    )
  }

  const [userCount, tenantCount] = await Promise.all([
    prisma.user.count({ where: { username: slug } }),
    prisma.tenant.count({ where: { slug } }),
  ])

  return Response.json({
    slug,
    available: userCount === 0 && tenantCount === 0,
  })
}
