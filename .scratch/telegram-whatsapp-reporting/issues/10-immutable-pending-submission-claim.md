# 10 — Immutable pending-submission claim

**What to build:** After a citizen explicitly confirms a complete draft, Effi freezes exactly one validated submission snapshot and sends a safe, short-lived claim link. The link contains no report content or evidence references, cannot alter the frozen report, and lets the citizen obtain a replacement link without creating another pending submission.

**Blocked by:** 09 — Anonymous channel draft persistence.

**Files:**

- Change: `packages/backend/convex/schema.ts`, `packages/backend/convex/reporting.ts`, `apps/bot-gateway/src/convex-report-store.ts`, `apps/bot-gateway/agent/lib/reporting.ts`, `apps/bot-gateway/agent/tools/prepare_submission.ts`, `apps/bot-gateway/agent/channels/telegram.ts`, `apps/bot-gateway/agent/channels/whatsapp.ts`, and `apps/bot-gateway/tests/durable-reporting.test.ts`.
- Create: None required beyond the durable reporting module from Ticket 09.

**Status:** ready-for-agent

- [ ] Explicit confirmation creates or returns one immutable pending submission containing the accepted interpretation, evidence references, exact location, confirmation time, and originating channel conversation.
- [ ] The bot-delivered URL carries only an opaque, securely stored single-use claim secret; report text, coordinates, media references, Convex identifiers, and authentication data never appear in the URL.
- [ ] A claim link expires after 24 hours, is bound to the pending submission and its original channel conversation, and cannot be used to change the frozen submission.
- [ ] During authentication pending, incoming channel messages receive a deterministic completion instruction and cannot steer or mutate the confirmed report.
- [ ] An expired link can be reissued after the citizen explicitly confirms the same frozen submission, without duplicating the pending submission.
- [ ] Behavioral tests prove explicit confirmation, snapshot immutability, opaque-link safety, expiry, replacement-link behavior, and duplicate-confirmation idempotency.
