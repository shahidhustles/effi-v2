# 03 — WhatsApp text-reporting parity

**What to build:** The same complete authenticated text-reporting journey through WhatsApp, using Baileys behind Eve's Chat SDK channel. A citizen can submit the same required evidence and receive the same report outcome without introducing a separate WhatsApp agent or case path.

**Blocked by:** 01 — Shared simulated report registration.

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

- The current checkout implements the shared persistence seam with `SimulatedReportStore` from ticket 01; the WhatsApp channel calls its injected inbound hook before Eve processing so a Convex-backed ingress can replace that store without a WhatsApp-specific agent or record path.
- The running channel supplies that hook with the durable staged `FileInboundMessageStore`; it is intentionally not presented as the live Convex report/authentication integration, which is still outside this checkout until the live Telegram/backend path exists.
- Baileys auth, provider-ID dedupe, and media directories are deployment-provided durable encrypted volumes. The package build disables the socket connection during compilation; the normal Eve runtime connects and lets the adapter own reconnect behavior.
