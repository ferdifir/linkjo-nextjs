# WhatsApp Inbound Intent And AI Agent Design

## Purpose

Linkjo needs a WhatsApp flow that is safer for account health and strong enough for paid usage. The design must not stop at outbound OTP replacement or a simple FAQ chatbot. WhatsApp should work as a tenant-aware AI agent with bounded conversation memory, structured state, deterministic business tools, and inbound-first verification.

The system must avoid cold outbound OTP as the default auth path. Users should start the WhatsApp conversation first by sending a generated intent token. The same global webhook should also support tenant customer conversations without relying on dynamic webhook URLs.

## Current State

- Owner authentication requests an outbound OTP from `POST /api/auth/request-otp`.
- The WhatsApp webhook is a single route, but currently requires `tenant_slug` from request body or query.
- Tenant slugs are useful for public web URLs, but not reliable for webhook routing.
- The AI assistant stores `History`, but the LLM call only receives the current message. Previous messages are not used as a context window.
- Business actions are mostly regex-driven inside `tryBusinessAction`.
- The AI cannot call structured tools. It cannot reliably inspect services, operational hours, queue status, booking state, or pending conversation state before answering.
- Public queue and booking flows create data immediately and then send outbound notifications.

## Goals

- Make owner phone verification inbound-first.
- Use one global WhatsApp webhook endpoint.
- Route inbound verification and action messages by intent token, not by tenant slug.
- Upgrade WhatsApp AI from regex/FAQ to an agent with tool calling.
- Use bounded conversation history as LLM context.
- Store structured conversation state per `tenantId + phone`.
- Support multi-turn, multi-day service selection without silently using stale state.
- Keep Fonnte working during this phase.
- Keep the design compatible with a future Baileys gateway or Meta Cloud API provider.
- Protect required dynamic placeholders in WhatsApp-related templates.

## Non-Goals

- Build a Baileys gateway service as part of this agent design change. That should be a separate infrastructure spec after the provider boundary is clean.
- Replace Fonnte as part of this agent design change. Fonnte remains an adapter until the self-hosted gateway is designed and deployed.
- Add mass broadcast messaging.
- Add one WhatsApp number per tenant.
- Let the LLM directly mutate database records without deterministic tools and validation.

## Recommended Approach

Use two separate concepts:

```text
WhatsappIntent
= short-lived token for inbound verification or a pending WhatsApp action
= structured, expiring, consumable

WhatsappConversationState
= persistent operational state for a customer conversation
= scoped to tenantId + phone
= stores pending intent, selected service, draft booking data, and last interaction metadata
```

Use Vercel AI SDK as the tool-calling layer because Linkjo is already a Next.js/TypeScript app. Groq can stay as the model provider through OpenAI-compatible APIs as long as the selected model supports tool/function calling.

## Global Webhook

Webhook endpoint:

```text
POST /api/webhooks/whatsapp?secret=...
```

The webhook must accept provider payload variants for:

- sender phone
- message body
- optional provider message id
- optional tenant hint only for legacy/internal fallback

The webhook must not require:

- tenant slug
- tenant id
- dynamic webhook path

Processing order:

1. Validate `WA_WEBHOOK_SECRET` from `x-webhook-secret` or `secret` query parameter.
2. Apply IP and sender rate limits.
3. Normalize sender phone.
4. Clean message text.
5. Extract a `WhatsappIntent` token from the message.
6. If a valid unconsumed intent exists, process it first.
7. If no token exists, route to the tenant AI agent only when tenant identity is known through a trusted path.
8. If tenant identity is unknown, return a generic response asking the user to start from the tenant public link.

## Inbound Owner Verification

Default auth flow:

1. User enters a WhatsApp number on the auth page.
2. Linkjo normalizes the number and rate-limits the request.
3. Linkjo creates a `WhatsappIntent` with:
   - `purpose = VERIFY_OWNER_PHONE`
   - `phoneExpected = normalized phone`
   - `expiresAt = now + 10 minutes`
4. Linkjo returns:
   - `contextCode`
   - `waLink`
   - expiry timestamp
5. UI shows a button to open WhatsApp.
6. User sends the prefilled message:

```text
LINKJO 8K4P2Q
```

7. The webhook receives the inbound message.
8. Linkjo validates the token and sender phone.
9. Linkjo consumes the intent atomically.
10. The web UI polls status and continues to username/onboarding.

Outbound OTP remains only as an explicit fallback path, not the primary action.

## Data Model

Rename the previous `WhatsappContext` idea to `WhatsappIntent` to avoid confusion with LLM context windows.

```prisma
model WhatsappIntent {
  id            String                @id @default(cuid())
  token         String                @unique
  tenantId      String?               @map("tenant_id")
  purpose       WhatsappIntentPurpose
  phoneExpected String?               @map("phone_expected")
  payload       Json                  @default("{}")
  expiresAt     DateTime              @map("expires_at")
  consumedAt    DateTime?             @map("consumed_at")
  createdAt     DateTime              @default(now()) @map("created_at")
  tenant        Tenant?               @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([phoneExpected])
  @@index([expiresAt])
  @@map("whatsapp_intents")
}

enum WhatsappIntentPurpose {
  VERIFY_OWNER_PHONE
  VERIFY_CUSTOMER_PHONE
  JOIN_QUEUE
  CREATE_BOOKING
  MANAGE_BOOKING
}
```

Add structured conversation state:

```prisma
model WhatsappConversationState {
  id                     String   @id @default(cuid())
  tenantId               String   @map("tenant_id")
  phone                  String
  pendingIntent          String?  @map("pending_intent")
  pendingServiceId       String?  @map("pending_service_id")
  pendingScheduledAt     DateTime? @map("pending_scheduled_at")
  pendingCustomerName    String?  @map("pending_customer_name")
  pendingBookingId       BigInt?  @map("pending_booking_id")
  pendingBookingToken    String?  @map("pending_booking_token")
  lastMentionedServiceId String?  @map("last_mentioned_service_id")
  lastBookingId          BigInt?  @map("last_booking_id")
  lastQueueId            BigInt?  @map("last_queue_id")
  lastInteractionAt      DateTime @default(now()) @map("last_interaction_at")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")
  tenant                 Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, phone])
  @@index([tenantId, lastInteractionAt])
  @@map("whatsapp_conversation_states")
}
```

Keep `History` as the append-only chat log and audit trail. It is not enough on its own because business decisions need structured state.

## AI Agent Framework

Use Vercel AI SDK Core for:

- tool definitions
- model calls
- multi-step tool calling
- structured validation around tool inputs

The AI agent should receive:

- tenant system prompt
- compact structured conversation state
- bounded recent history
- current user message
- available tools

The agent must not receive unlimited history.

## Context Window Policy

When answering a WhatsApp message, build model context as:

1. System prompt with tenant data, allowed actions, and safety rules.
2. Structured state summary for `tenantId + phone`.
3. Recent history limited by count and text length, for example:
   - last 20 messages
   - max 500 characters per message
   - newest relevant messages only
4. Current user message.
5. Tool definitions.

If history is still too long, prefer structured state and recent user intent over old conversation text.

## Tool Calling Design

The LLM may only perform business operations through these tools:

```text
listServices()
getOperationalHours()
getTenantProfile()
checkQueueStatus(phone)
joinQueue(name, phone)
cancelQueue(phone)
listActiveBookings(phone)
getBooking(bookingId, phone, publicToken)
createBooking(serviceId, scheduledAt, phone, customerName, notes)
rescheduleBooking(bookingId, publicToken, scheduledAt, phone)
cancelBooking(bookingId, publicToken, phone)
updateConversationState(patch)
clearPendingConversationState()
```

Tool rules:

- Tools validate tenant scope server-side.
- Tools never accept `tenantId` from the model.
- Tools use the tenant and phone from the trusted webhook/session context.
- Tools enforce operational hours and existing booking rules.
- Tools return structured results with status and user-safe messages.
- Tools log enough detail for debugging without exposing secrets.

## Deterministic Guardrails

AI text may explain and ask questions, but deterministic code decides whether an action is valid.

For mutating actions:

- If required fields are missing, the agent asks for the missing fields.
- If there is ambiguity, the agent asks for confirmation.
- If the user changes service/date/time, the latest explicit user input overrides old state.
- If the state is stale, the agent must not silently reuse it.

Stale state policy:

- Pending booking or queue state older than 24 hours should require reconfirmation.
- Last mentioned service can be used as a hint, not as final input, after a day boundary.
- Any phrase like "yang tadi", "yang satunya", or "seperti kemarin" must be resolved from state/history and confirmed if there is more than one possible match.

## Multi-Service And Multi-Day Behavior

If a customer asks about service A today and service B tomorrow, the system must not force service A into tomorrow's action.

Expected behavior examples:

```text
User: Ada haircut?
Bot: Ada. Harga dan durasi...
User tomorrow: Saya mau hair coloring jam 2.
Bot: Konfirmasi booking Hair Coloring besok pukul 14:00?
```

If the user says:

```text
User: Saya mau yang satunya besok jam 2.
```

The agent must inspect state/history. If there are multiple possible services, it must ask:

```text
Maksudnya Haircut atau Hair Coloring?
```

## Confirmation Policy

Confirmation is required before these actions:

- create booking
- reschedule booking
- cancel booking
- cancel queue

Queue join can be immediate only when the user explicitly asks to take a queue number and the required name/phone is known. If name is missing, ask for a name or use a tenant-configured default rule.

Confirmation state should be stored in `WhatsappConversationState.pendingIntent` and related pending fields.

Example:

```text
Bot: Konfirmasi booking Haircut Premium pada 20 Juli 2026 pukul 14:00?
User: Ya
Tool: createBooking(...)
```

## Regex Fallback

Existing regex commands may remain as a fast path for explicit commands:

```text
ambil antrian
cek status
batal booking 123 <token>
```

But regex must not be the primary intelligence layer. Natural language and ambiguous flows should go through the AI agent and tools.

## Templates

Add a system template for inbound verification copy:

```text
LINKJO {context_code}
```

Required placeholders must be protected:

- `{context_code}` for inbound intent messages
- existing queue placeholders such as `{no}` and `{estimated_wait_min}`
- existing booking placeholders such as `{booking_id}`, `{service}`, `{scheduled_at}`, and `{public_token}`

When a tenant edits a template, save must fail if required placeholders are missing.

## Error Handling

Expected cases:

- token not found
- token expired
- token already consumed
- sender phone does not match `phoneExpected`
- missing sender phone
- missing message body
- webhook secret invalid
- rate limit exceeded
- model call timeout
- tool call validation failure
- tool execution failure
- unknown tenant for a non-token inbound message

The webhook should avoid leaking token state to end users. Authentication failures return `401`. User mistakes may return a generic successful provider response while logging server-side detail.

## Security And Abuse Controls

- Rate-limit intent creation by IP and phone.
- Rate-limit webhook processing by IP and sender phone.
- Expire verification intents after 10 minutes.
- Consume intents atomically.
- Match sender phone against `phoneExpected` for owner verification.
- Store webhook secret outside source code.
- Do not include secrets in WhatsApp links.
- Do not pass tenant id, secrets, raw tokens, or internal errors to the model.
- Never let model-provided arguments override trusted tenant or phone context.

## Testing

Unit tests:

- intent token extraction from message text
- intent expiration
- consumed intent rejection
- phone mismatch rejection
- required placeholder validation
- bounded history construction
- conversation state update/clear behavior
- tool input validation
- stale state decision rules

Integration tests:

- auth creates inbound WhatsApp intent
- simulated webhook verifies owner phone
- AI agent receives recent history and state
- AI agent calls `listServices` for a service question
- AI agent asks for missing booking date/time
- AI agent stores pending booking state
- AI agent confirms and calls `createBooking`
- AI agent handles user switching from one service to another on the next day

E2E tests:

- user signs up through inbound WhatsApp verification without outbound OTP
- customer asks about a service, then books a different service later
- customer tries ambiguous "yang satunya" flow and receives a clarification question

Regression tests:

- old notification templates still render
- existing queue and booking validations still pass
- webhook rejects invalid secret in production-like mode

## Rollout Plan

1. Add Prisma models for `WhatsappIntent` and `WhatsappConversationState`.
2. Add intent creation, token parsing, atomic consumption, and auth verification status helpers.
3. Update auth API and UI to use inbound verification by default.
4. Update global webhook to process intents before tenant AI routing.
5. Add AI SDK dependency and wrap Groq as the model provider.
6. Build bounded history and conversation state loading.
7. Implement business tools with server-side tenant and phone scoping.
8. Replace the current FAQ-only LLM path with tool-calling agent flow.
9. Keep regex commands only as explicit fast-path fallback.
10. Add unit, integration, and E2E coverage.
11. Keep outbound OTP behind an explicit fallback path.

## Decisions

- Default owner authentication uses inbound WhatsApp verification with `LINKJO {context_code}`.
- Dynamic tenant webhook URLs are not used.
- `WhatsappIntent` is the name for short-lived action tokens.
- `WhatsappConversationState` handles structured AI memory per tenant and phone.
- `History` remains the append-only log and bounded LLM context source.
- Vercel AI SDK is the preferred tool-calling framework for this codebase.
- The model cannot mutate business data except through validated server-side tools.
