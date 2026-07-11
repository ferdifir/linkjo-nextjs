import { withRequiredClaims } from '@/lib/auth'
import { getTenantTemplates } from '@/lib/notifications'

export async function GET() {
  return withRequiredClaims(async ({ tenant_id }) => {
    const templates = await getTenantTemplates(tenant_id)
    return Response.json(templates)
  })
}
