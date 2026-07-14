# Linkjo

Linkjo adalah aplikasi antrian dan booking multi-tenant dengan halaman publik per tenant, notifikasi WhatsApp, dan webhook percakapan AI untuk customer.

## Getting Started

Install dependencies and generate Prisma client:

```bash
npm install
npx prisma generate
```

Create local environment variables:

```bash
cp .env.example .env
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
WA_WEBHOOK_SECRET="shared-secret-for-x-webhook-secret"
NEXT_PUBLIC_PUBLIC_APP_URL="https://linkjo.co"
WHATSAPP_PROVIDER="fonnte"
WHATSAPP_NUMBER="628xxxxxxxxxx"
```

Optional:

```bash
FONNTE_API_KEY="..."
FONNTE_WHATSAPP_NUMBER="628xxxxxxxxxx"
NEXT_PUBLIC_WHATSAPP_NUMBER="628xxxxxxxxxx"
GROQ_API_KEY="..."
GROQ_MODEL="llama-3.1-8b-instant"
WHATSAPP_SHARED_DIR="/var/www/linkjo-next/shared"
WHATSAPP_BAILEYS_AUTH_DIR="/var/www/linkjo-next/shared/baileys-auth"
WHATSAPP_STATUS_PATH="/var/www/linkjo-next/shared/whatsapp-status.json"
WHATSAPP_OUTBOX_POLL_MS="2000"
WHATSAPP_OUTBOX_BATCH_SIZE="10"
BAILEYS_LOG_LEVEL="silent"
LOG_LEVEL="info"
```

`JWT_SECRET` and `WA_WEBHOOK_SECRET` are mandatory in production. `WA_WEBHOOK_SECRET` is an application-level guard for inbound webhook URLs, not a Fonnte credential. `WHATSAPP_PROVIDER` defaults to `fonnte`; set it to `baileys` to route outbound WhatsApp messages through the Baileys worker outbox. `NEXT_PUBLIC_PUBLIC_APP_URL` is used for canonical public tenant URLs, clickable account links, and QR codes. If `GROQ_API_KEY` is not set, the WhatsApp inbound handler still handles queue and booking commands with deterministic fallback replies.

Provider-specific requirements:

- `WHATSAPP_PROVIDER=fonnte`: set `FONNTE_API_KEY`. Keep the global Fonnte webhook URL configured.
- `WHATSAPP_PROVIDER=baileys`: set `WHATSAPP_SHARED_DIR`, `WHATSAPP_BAILEYS_AUTH_DIR`, and `WHATSAPP_STATUS_PATH`; deploy starts PM2 app `linkjo-wa-worker`, then scan the QR from `pm2 logs linkjo-wa-worker`.

## Database

Apply migrations before running production:

```bash
npx prisma migrate deploy
```

The schema includes tenant-isolated queue numbers, public bookings, chat history, templates, WhatsApp conversation state, WhatsApp outbound outbox, audit events, and typed queue/booking statuses.

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

## WhatsApp Integration

Linkjo uses one global system WhatsApp number. Tenant routing for customer replies is based on trusted Linkjo context: owner verification intents and `WhatsappConversationState` seeded by previous Linkjo notifications.

Supported providers:

- `fonnte`: HTTP send API plus the global inbound webhook below.
- `baileys`: long-running worker process using WhatsApp linked-device session.

When `WHATSAPP_PROVIDER=baileys`, outbound messages are written to `whatsapp_outbound_messages`; the `linkjo-wa-worker` PM2 process sends them through the active Baileys socket. Baileys auth/session files must live in a shared persistent directory, not inside a release folder.

Run the worker locally with:

```bash
npm run wa:worker
```

Production deploy manages the worker as PM2 app `linkjo-wa-worker` only when `WHATSAPP_PROVIDER=baileys`.

## Fonnte Webhook

Inbound webhook endpoint:

```text
POST /api/webhooks/whatsapp?secret=<secret>
```

Accepted JSON fields are intentionally flexible:

```json
{
  "from": "6281234567890",
  "message": "ambil antrian nama saya Budi"
}
```

Fonnte sends inbound payload fields such as `sender`, `message`, `name`, `location`, and `inboxid`. Configure one global webhook URL in Fonnte:

```text
https://linkjo.my.id/api/webhooks/whatsapp?secret=<secret>
```

If the webhook provider supports custom headers, the secret can also be sent as:

```text
x-webhook-secret: <secret>
```

Do not configure one webhook URL per tenant. The URL is global.

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
npm run test
npm run build
npm run test:e2e
```

## CI/CD

CI runs on pull requests and pushes to `main` through `.github/workflows/ci.yml`. It starts a PostgreSQL service, applies Prisma migrations, runs lint, unit tests, build, Playwright E2E, and a high-severity production dependency audit.

Production deploy runs through `.github/workflows/deploy.yml` on manual dispatch or version tags matching `v*`. The deploy workflow repeats the validation suite first, then connects to the VPS over SSH and runs `scripts/deploy-vps.sh`. Application secrets stay on the server in:

```text
/var/www/linkjo-next/shared/.env
```

Required GitHub secret:

```text
VPS_SSH_KEY
```

Optional GitHub secrets override the defaults:

```text
VPS_HOST
VPS_PORT
VPS_USER
PRODUCTION_URL
```

The deploy script uploads a timestamped release to `/var/www/linkjo-next/releases`, links the shared `.env`, runs `npm ci`, `prisma generate`, `prisma migrate deploy`, `npm run build`, then switches `/var/www/linkjo-next/current` and reloads PM2. If the local smoke test fails, it switches back to the previous release.

Manual deploy from this machine:

```bash
scripts/deploy-vps.sh
```

Rollback to the previous release:

```bash
scripts/rollback-vps.sh
```

Rollback to a specific release directory name:

```bash
scripts/rollback-vps.sh 20260712180000-abcdef123456
```

Release versioning uses semantic version tags. For a patch release:

```bash
npm version patch
git push origin main --follow-tags
```

Use `npm version minor` for compatible feature releases and `npm version major` for breaking releases.

## Notes

QR codes are generated internally through `/api/qr`.
