# 06 — Steering, resumption, and duplicate protection

**What to build:** A resilient conversation path in which rapid citizen messages converge into one coherent turn, interrupted complaints resume in their original channel, and retries from platforms or authentication cannot duplicate messages, submissions, or reports.

**Blocked by:** 02 — Live Telegram text reporting; 03 — WhatsApp text-reporting parity.

**Status:** completed

- [x] Each inbound message is durably persisted before it can steer an active Eve turn.
- [x] A rapid text, photo, and location burst cancels obsolete work and produces one coherent response based on the complete persisted conversation.
- [x] Streaming delivery is disabled so partial output from a cancelled turn never reaches Telegram or WhatsApp.
- [x] No consequential submission tool can run while the report remains unconfirmed and steerable.
- [x] Explicit confirmation locks the conversation; messages received while authentication is pending return a deterministic instruction rather than steering the submission.
- [x] An incomplete report resumes from the same Eve session and persisted conversation when the citizen returns through its original channel.
- [x] A report never resumes through a different channel or inherits details from an older registered complaint.
- [x] Repeated Telegram and WhatsApp provider message IDs are ignored without duplicating persisted messages or model turns.
- [x] Pending submission and authentication callback idempotency keys prevent duplicate reports under retries or concurrent delivery.
- [x] Separate citizens and conversations continue concurrently without sharing report state.

## Comments

- Added shared persisted ingress, Eve `steer` configuration, non-streaming WhatsApp delivery, deterministic authentication-pending replies, durable Telegram/WhatsApp provider-ID dedupe, active-conversation-only resumption, and concurrent authentication idempotency protection.
- Context7 and installed Eve 0.39 docs confirm `turnPolicy: "steer"`, stable thread resumption, and `streaming: false` for the Chat SDK adapter; Telegram's native channel emits completed turns.
- Added burst, isolation, durable Telegram dedupe, old-registered-conversation, and concurrent authentication coverage.
- Validation: `pnpm check` passed; bot gateway typecheck and 35 tests passed.
