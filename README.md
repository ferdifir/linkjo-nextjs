# Linkjo

Linkjo adalah aplikasi antrian dan booking multi-tenant dengan halaman publik per tenant, notifikasi WhatsApp, dan webhook percakapan AI untuk customer.

## Getting Started

Install dependencies and generate Prisma client:

```bash
npm install
npx prisma generate
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment

Required:

```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="long-random-secret"
FONNTE_API_KEY="..."
WA_WEBHOOK_SECRET="shared-secret-for-x-webhook-secret"
PUBLIC_APP_URL="https://linkjo.co"
```

Optional:

```bash
GROQ_API_KEY="..."
GROQ_MODEL="llama-3.1-8b-instant"
```

`JWT_SECRET` and `WA_WEBHOOK_SECRET` are mandatory in production. OTP and customer notifications are sent through Fonnte. `PUBLIC_APP_URL` is used for canonical public tenant URLs and QR codes. If `GROQ_API_KEY` is not set, the WhatsApp webhook still handles queue and booking commands with deterministic fallback replies.

## Database

Apply migrations before running production:

```bash
npx prisma migrate deploy
```

The schema includes tenant-isolated queue numbers, public bookings, chat history, templates, and typed queue/booking statuses.

Queue numbers reset daily per tenant using the Asia/Jakarta business date. Apply the latest migration before production deploy so historical queue rows receive `queue_date` and the daily unique index is created.

## Operational Hours

Bookings are owner-driven: public booking requests are created as `pending`, and the owner decides whether adjacent or overlapping times are acceptable.

Services are structured per tenant. Public booking requires selecting an active service, and bookings keep a service name/duration snapshot so historical bookings remain readable if the owner later edits services.

Operational hours are stored in `tenant.operational_hours` as JSON and are used both for public display and booking validation. If empty, booking time is not restricted. Example:

```json
{
  "timeZone": "Asia/Jakarta",
  "weekly": {
    "mon": [{ "start": "09:00", "end": "17:00" }],
    "tue": [{ "start": "09:00", "end": "17:00" }]
  }
}
```

Supported day keys are `sun`, `mon`, `tue`, `wed`, `thu`, `fri`, and `sat`. Overnight ranges such as `{ "start": "20:00", "end": "02:00" }` are supported. Public pages and AI responses compact repeated ranges, for example `Senin-Jumat 06:00-17:00`.

## Public Tenant URL

After signup and onboarding, each tenant gets a public page:

```text
/{tenant-slug}
```

Customers do not log in. They enter their name and WhatsApp number to receive queue or booking notifications.

## WhatsApp Webhook

Inbound webhook endpoint:

```text
POST /api/webhooks/whatsapp?tenant={tenant-slug}
```

Accepted JSON fields are intentionally flexible:

```json
{
  "tenant_slug": "nama-bisnis",
  "from": "6281234567890",
  "message": "ambil antrian nama saya Budi"
}
```

If `WA_WEBHOOK_SECRET` is set, send it as:

```text
x-webhook-secret: <secret>
```

Supported commands include taking a queue number, checking queue status, canceling an active queue, and creating a booking with:

```text
booking <layanan> <YYYY-MM-DD> <HH:mm>
```

Customers can reschedule or cancel bookings with the booking token returned by the public booking form or WhatsApp notification:

```text
reschedule <nomor-booking> <token> <YYYY-MM-DD> <HH:mm>
batal booking <nomor-booking> <token>
```

## Production Checks

```bash
npm run lint
npm run build
```

## Notes

QR codes are generated internally through `/api/qr`.
