# WhatsApp Inbound Context Design

## Purpose

Linkjo should reduce WhatsApp ban risk by avoiding cold outbound OTP messages as the default verification path. The default flow should ask the user to start the WhatsApp conversation first, then Linkjo verifies the user from the inbound message.

This design also fixes webhook routing for providers that only support one webhook URL. Tenant routing must not depend on a dynamic webhook path or tenant slug query parameter. Inbound messages must carry a context token that lets Linkjo determine the tenant, purpose, and related payload.

## Current State

- Owner authentication currently requests an outbound OTP from `POST /api/auth/request-otp`.
- The WhatsApp webhook is a single route, but it currently requires `tenant_slug` in the request body or query.
- Tenant slugs are useful for public web URLs, but they are not reliable for webhook routing.
- Message templates already support required variables for notification templates.
- Public queue and booking flows create data immediately and then send outbound notifications.

## Goals

- Make owner phone verification inbound-first.
- Use one global WhatsApp webhook endpoint.
- Route inbound WhatsApp messages by context token, not by tenant slug.
- Keep Fonnte working during this phase.
- Keep the design compatible with a future Baileys or Meta Cloud API provider.
- Protect required dynamic placeholders in WhatsApp-related templates.

## Non-Goals

- Build a Baileys gateway service in this phase.
- Replace Fonnte in this phase.
- Add mass broadcast messaging.
- Add one WhatsApp number per tenant.
- Convert all queue and booking operations to WhatsApp-confirmed flows immediately.

## Recommended Approach

Use an inbound context token.

The app generates a short token for a specific purpose. The user clicks a WhatsApp link with a prefilled message such as:

```text
LINKJO 8K4P2Q
```

The provider posts inbound messages to one global webhook:

```text
POST /api/webhooks/whatsapp?secret=...
```

The webhook extracts the token from the message, looks up the stored context, validates the sender phone when required, consumes the context, and runs the matching action.

## Data Model

Add a `WhatsappContext` model:

```prisma
model WhatsappContext {
  id            String                 @id @default(cuid())
  token         String                 @unique
  tenantId      String?                @map("tenant_id")
  purpose       WhatsappContextPurpose
  phoneExpected String?                @map("phone_expected")
  payload       Json                   @default("{}")
  expiresAt     DateTime               @map("expires_at")
  consumedAt    DateTime?              @map("consumed_at")
  createdAt     DateTime               @default(now()) @map("created_at")
  tenant        Tenant?                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([phoneExpected])
  @@index([expiresAt])
  @@map("whatsapp_contexts")
}

enum WhatsappContextPurpose {
  VERIFY_OWNER_PHONE
  VERIFY_CUSTOMER_PHONE
  JOIN_QUEUE
  CREATE_BOOKING
  MANAGE_BOOKING
}
```

For the first implementation, only `VERIFY_OWNER_PHONE` is required. Other purposes are included so the table and parser do not need to be redesigned later.

## Owner Auth Flow

1. User enters a WhatsApp number on the auth page.
2. Linkjo normalizes the number and rate-limits the request.
3. Linkjo creates a `WhatsappContext` with:
   - `purpose = VERIFY_OWNER_PHONE`
   - `phoneExpected = normalized phone`
   - `expiresAt = now + 10 minutes`
4. Linkjo returns:
   - `contextCode`
   - `waLink`
   - expiry timestamp
5. UI shows a button to open WhatsApp.
6. User sends the prefilled message.
7. The global webhook receives the inbound message.
8. Linkjo extracts the token and validates:
   - token exists
   - token is not expired
   - token is not consumed
   - sender phone matches `phoneExpected`
9. Linkjo consumes the context and marks the phone as verified for login.
10. The web UI polls a verification status endpoint and then continues to username/onboarding.

Outbound OTP should become a fallback only, not the default path.

## Webhook Flow

Webhook endpoint:

```text
POST /api/webhooks/whatsapp?secret=...
```

The webhook must accept provider payload variants for:

- sender phone
- message body
- optional message id

The webhook must not require:

- tenant slug
- tenant id
- dynamic webhook path

Processing order:

1. Validate `WA_WEBHOOK_SECRET` from `x-webhook-secret` or `secret` query parameter.
2. Apply IP and sender rate limits.
3. Normalize sender phone.
4. Clean message text.
5. Extract a context token from the message.
6. If a valid unconsumed context exists, process it first.
7. If no context token exists, optionally fall back to existing tenant AI assistant only when the payload explicitly contains a trusted tenant reference. This fallback should not be used for verification.

## Token Format

Use short uppercase alphanumeric tokens, excluding confusing characters when practical.

Example:

```text
8K4P2Q
```

Accepted message examples:

```text
LINKJO 8K4P2Q
Verifikasi Linkjo 8K4P2Q
8K4P2Q
```

The parser should search for a token-like segment and not require exact full-message equality.

## Templates

Add a system template for inbound verification copy:

```text
LINKJO {context_code}
```

Required placeholders must be protected:

- `{context_code}` for inbound context messages
- existing queue placeholders such as `{no}` and `{estimated_wait_min}`
- existing booking placeholders such as `{booking_id}`, `{service}`, `{scheduled_at}`, and `{public_token}`

When a tenant edits a template, save must fail if required placeholders are missing.

## Error Handling

Invalid inbound contexts should not leak detailed state to the provider response.

Expected cases:

- token not found
- token expired
- token already consumed
- sender phone does not match `phoneExpected`
- missing sender phone
- missing message body
- webhook secret invalid
- rate limit exceeded

The webhook may return a generic successful response for user mistakes after logging enough server detail for debugging. Authentication failures should still return `401`.

## UI Behavior

Auth page changes:

- Replace the default "Kirim OTP" action with "Verifikasi lewat WhatsApp".
- After the context is created, show a WhatsApp open button.
- Show compact status text while waiting for inbound verification.
- Poll verification status until verified or expired.
- Provide a retry action after expiry.
- Keep outbound OTP as a fallback only if the system explicitly enables it.

No latitude/longitude or tenant slug should be exposed as part of this verification flow.

## Security And Abuse Controls

- Rate-limit context creation by IP and phone.
- Rate-limit webhook processing by IP and sender phone.
- Expire verification contexts after 10 minutes.
- Consume contexts atomically to prevent reuse.
- Match sender phone against `phoneExpected` for owner verification.
- Store webhook secret outside source code.
- Do not include secrets in generated WhatsApp links.

## Testing

Unit tests:

- token extraction from message text
- context expiration
- consumed context rejection
- phone mismatch rejection
- required placeholder validation
- auth context status transitions

Integration or E2E tests:

- user enters phone
- app generates WhatsApp verification link
- test reads context token from the database
- test posts a simulated inbound webhook using that token
- app proceeds to username/onboarding without outbound OTP

Regression tests:

- old notification templates still render
- existing queue and booking notification tests still pass
- webhook rejects invalid secret in production-like mode

## Rollout Plan

1. Add the data model and migration.
2. Add context creation, token parsing, context consumption, and verification status helpers.
3. Update auth API and UI to use inbound verification by default.
4. Update webhook routing to process context tokens before tenant assistant logic.
5. Add template support for inbound context messages.
6. Add unit and E2E coverage.
7. Keep outbound OTP behind a fallback path for operational recovery.

## Decision

The approved default behavior is: owner authentication uses inbound WhatsApp verification with `LINKJO {context_code}`. Outbound OTP remains only as a fallback path and is not shown as the primary action.
