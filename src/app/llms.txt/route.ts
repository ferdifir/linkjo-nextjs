import { getPublicAppUrl } from "@/lib/public-url"

export function GET() {
  const publicAppUrl = getPublicAppUrl()
  const body = `# Linkjo

> Linkjo is a multi-tenant queue and booking application for local service businesses in Indonesia.

Linkjo helps business owners publish a tenant page, manage daily queues, receive booking requests, configure services and operational hours, and send WhatsApp notifications to customers.

## Public Pages

- [Home](${publicAppUrl}/): Product entry page for business owners.
- [Sign in](${publicAppUrl}/auth): Phone and OTP authentication for business owners.
- [Onboarding](${publicAppUrl}/onboarding): Business profile completion flow after signup.

## Customer-Facing Capabilities

- Public tenant pages are available at \`${publicAppUrl}/{tenant-slug}\`.
- Customers can join a queue from a tenant page without logging in.
- Customers can request bookings for active services during configured operational hours.
- WhatsApp notifications may be sent for OTP, queue, and booking events when configured.

## Owner Capabilities

- Owners manage active queues from the dashboard.
- Owners configure profile information, services, operational hours, location, and message templates.
- Owners can review analytics and operational history.

## API And Private Areas

- Dashboard, settings, analytics, onboarding, and API routes may require authentication.
- Do not infer private tenant, customer, queue, booking, phone, OTP, or webhook secret data from this file.
- API routes are application endpoints, not general crawling targets.

## Notes For AI Agents

- Treat tenant slugs as user-generated public paths.
- Prefer links listed in this file and \`${publicAppUrl}/sitemap.xml\` for public discovery.
- Dynamic message template variables are intentional placeholders and should not be rewritten when helping users edit templates.
`

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  })
}
