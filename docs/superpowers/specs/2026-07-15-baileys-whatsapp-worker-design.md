# Baileys WhatsApp Worker Design

Date: 2026-07-15
Branch: `feature/migrate-whatsapp-baileys`

## Goal

Migrate Linkjo's WhatsApp integration from a Fonnte webhook-centered flow to a Baileys-based WhatsApp worker while keeping one global Linkjo WhatsApp number for the whole system.

The migration must preserve existing business behavior:

- Owner WhatsApp verification through intent tokens.
- Customer routing to the correct tenant through `WhatsappConversationState`.
- Queue actions from WhatsApp.
- Booking create, reschedule, cancel, and status flows.
- Tenant unresolved fallback replies.
- Existing audit and structured logging.

## Non-Goals

- Multi-number WhatsApp per tenant.
- Automatic provider failover.
- Group chat support.
- Replacing the AI/business flow.
- Rebuilding tenant routing around tenant-specific WhatsApp numbers.

## Architecture

The WhatsApp integration will be split into three explicit layers.

### 1. Business Message Handler

Create a reusable inbound handler that accepts normalized message input:

```ts
type WhatsappInboundMessage = {
  from: string
  message: string
  source: "fonnte_webhook" | "baileys_worker"
}
```

The handler owns the current business flow that is now embedded in `src/app/api/webhooks/whatsapp/route.ts`:

- Validate and normalize sender/message.
- Consume owner verification intent when the message contains a token.
- Resolve tenant from an optional tenant hint or existing conversation state.
- Send tenant unresolved fallback reply when no tenant can be resolved.
- Call `handleInboundCustomerMessage` when a tenant is resolved.
- Write audit events for WhatsApp actions.
- Emit structured logs with masked phone numbers and request/job context.

The webhook route becomes a thin adapter. The Baileys worker becomes another adapter.

### 2. WhatsApp Provider Abstraction

Introduce a provider-neutral send API:

```ts
sendWhatsappMessage(target: string, message: string, options?: SendWhatsappOptions)
```

The provider is selected by environment:

```env
WHATSAPP_PROVIDER=baileys
```

Supported providers during migration:

- `fonnte`: existing HTTP API sender, kept for rollback and compatibility.
- `baileys`: worker-backed sender.

The abstraction prevents business modules such as notifications and AI handlers from importing `src/lib/fonnte.ts` directly.

### 3. Baileys Worker

Add a long-running Node worker, separate from Next.js:

```txt
src/workers/whatsapp-baileys-worker.ts
```

The worker will run under PM2 as a separate app:

```txt
linkjo-wa-worker
```

Responsibilities:

- Load the same production env as the Next.js app.
- Connect to WhatsApp through Baileys.
- Persist auth/session data outside release directories.
- Print or log QR pairing instructions when a session is not paired.
- Listen for inbound personal chat messages.
- Ignore group, broadcast, newsletter, status, and self-sent messages.
- Normalize sender phone and text body.
- Call the reusable business message handler.
- Send replies through the Baileys socket.
- Log connection lifecycle and message handling results.

## Runtime State

Baileys auth state must be stored in a persistent shared path on the VPS:

```txt
/var/www/linkjo-next/shared/baileys-auth
```

This directory must not live inside a release directory because releases are replaced during deploys.

The worker also needs a lightweight status output. The first implementation can store status in a shared JSON file:

```txt
/var/www/linkjo-next/shared/whatsapp-status.json
```

Status fields:

- `provider`
- `connected`
- `lastConnectedAt`
- `lastDisconnectedAt`
- `lastError`
- `phoneNumber`
- `updatedAt`

This keeps the first migration small and avoids adding a DB model only for worker health.

## API Changes

### `/api/webhooks/whatsapp`

The route remains available while Fonnte compatibility exists. It should only adapt HTTP payloads into the reusable inbound handler.

The global webhook rule remains unchanged:

```txt
https://linkjo.my.id/api/webhooks/whatsapp?secret=<WA_WEBHOOK_SECRET>
```

No tenant query parameter is used for production routing.

### `/api/system/wa-status`

This route should return provider-aware status:

```json
{
  "provider": "baileys",
  "connected": true,
  "lastConnectedAt": "2026-07-15T00:00:00.000Z",
  "lastDisconnectedAt": null,
  "lastError": null,
  "phoneNumber": "628..."
}
```

When `WHATSAPP_PROVIDER=fonnte`, it can continue using existing Fonnte readiness.

## Deployment

The VPS deploy flow must manage two PM2 apps:

- `linkjo-next`
- `linkjo-wa-worker`

Deployment requirements:

- Install Baileys dependency.
- Build Next.js and worker code.
- Preserve `/var/www/linkjo-next/shared/baileys-auth`.
- Reload the Next.js app.
- Reload or start the Baileys worker.
- Keep PM2 logrotate active for both apps.

The worker must not be started in environments where `WHATSAPP_PROVIDER` is not `baileys`.

## Error Handling

Expected behaviors:

- If Baileys is disconnected, send attempts fail with a structured log and return `{ success: false }`.
- If QR pairing is required, worker logs a clear status and keeps running.
- If a message is unsupported or from a group/status/broadcast, worker ignores it and logs at debug level.
- If business handling fails, worker logs the error and sends a short generic failure reply only when safe.
- Phone numbers and message bodies are not logged verbatim. Logs may include masked phones and message length.

## Testing

Minimum coverage:

- Inbound handler consumes owner verification intent.
- Inbound handler sends fallback reply for unresolved tenant.
- Inbound handler routes resolved tenant messages to `handleInboundCustomerMessage`.
- Webhook route delegates to the inbound handler and preserves secret/rate-limit checks.
- Provider abstraction sends through Fonnte when configured.
- Provider abstraction fails clearly when Baileys provider is selected but worker/socket is unavailable.
- Baileys message parser extracts text from supported personal chat messages.
- Baileys message parser ignores group/status/broadcast/self messages.
- Status API returns Baileys status from the shared status file.

Existing tests for queue, booking, notifications, AI assistant, logging, and webhook routing must continue to pass.

## Rollback

Rollback path:

1. Set `WHATSAPP_PROVIDER=fonnte`.
2. Stop `linkjo-wa-worker`.
3. Keep the global Fonnte webhook URL configured.
4. Redeploy or reload PM2.

The existing Fonnte implementation remains in the codebase during this migration specifically to make rollback simple.
