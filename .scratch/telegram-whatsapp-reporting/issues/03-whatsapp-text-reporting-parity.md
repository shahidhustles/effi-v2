# 03 — WhatsApp text-reporting parity

**What to build:** The same complete authenticated text-reporting journey through WhatsApp, using Baileys behind Eve's Chat SDK channel. A citizen can submit the same required evidence and receive the same report outcome without introducing a separate WhatsApp agent or case path.

**Blocked by:** 01 — Shared simulated report registration; 02 — Live Telegram text reporting.

**Status:** completed

- [x] The Baileys adapter connects through a persistent WebSocket in the always-on Eve service and restores its account authentication from durable encrypted storage.
- [x] WhatsApp messages are routed through Eve's Chat SDK channel into the same reporting agent and shared inbound contract used by Telegram.
- [x] WhatsApp text, image, current-location, and manually selected pin inputs complete the same report journey as their Telegram equivalents.
- [x] WhatsApp media is acquired and copied into Effi-controlled storage before model processing.
- [x] Provider message IDs deduplicate repeated WhatsApp events.
- [x] The final interpretation supports available channel actions and natural-language corrections without making action support a requirement for completion.
- [x] The authentication link is bound to the pending submission and originating WhatsApp conversation and creates exactly one authenticated report.
- [x] WhatsApp returns a clear acknowledgement and the same form of report ID as Telegram.
- [x] Reports, conversations, evidence references, and coordinates produced through WhatsApp use the same Convex records and officer pipeline as Telegram.
- [x] The implementation and citizen-facing behavior identify Baileys as a staged hackathon transport rather than a production WhatsApp guarantee.
- [x] No WhatsApp action or natural-language request exposes report or case status.

## Comments

- WhatsApp now uses the same `SharedReportIngress`, `SimulatedReportStore`, evidence tools, pending-submission validation, authentication binding, idempotent report creation, and report-ID acknowledgement path as Telegram.
- Persistent Baileys socket events re-enter Eve through a secret-protected internal channel route with its own durable provider-ID receipt; failed dispatch claims remain retryable, ambiguous responses do not duplicate a model turn, and already-persisted inbound records resume without duplicating the report conversation.
- For tickets 02 and 03, the checked shared-record criterion means parity through the staged shared report seam. Ticket 08 owns replacing that one seam with the final Convex persistence and officer pipeline; this ticket does not claim that migration is already live.
- Baileys auth, provider-ID dedupe, and media directories are deployment-provided durable encrypted volumes. The package build disables the socket connection during compilation; the normal Eve runtime connects and lets the adapter own reconnect behavior.
- Validation: the full `pnpm check` passes on Node 24, including 31 bot-gateway tests and Eve discovery/build.
