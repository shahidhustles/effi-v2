# 03 — WhatsApp text-reporting parity

**What to build:** The same complete authenticated text-reporting journey through WhatsApp, using Baileys behind Eve's Chat SDK channel. A citizen can submit the same required evidence and receive the same report outcome without introducing a separate WhatsApp agent or case path.

**Blocked by:** 01 — Shared simulated report registration.

**Status:** ready-for-agent

- [ ] The Baileys adapter connects through a persistent WebSocket in the always-on Eve service and restores its account authentication from durable encrypted storage.
- [ ] WhatsApp messages are routed through Eve's Chat SDK channel into the same reporting agent and shared inbound contract used by Telegram.
- [ ] WhatsApp text, image, current-location, and manually selected pin inputs complete the same report journey as their Telegram equivalents.
- [ ] WhatsApp media is acquired and copied into Effi-controlled storage before model processing.
- [ ] Provider message IDs deduplicate repeated WhatsApp events.
- [ ] The final interpretation supports available channel actions and natural-language corrections without making action support a requirement for completion.
- [ ] The authentication link is bound to the pending submission and originating WhatsApp conversation and creates exactly one authenticated report.
- [ ] WhatsApp returns a clear acknowledgement and the same form of report ID as Telegram.
- [ ] Reports, conversations, evidence references, and coordinates produced through WhatsApp use the same Convex records and officer pipeline as Telegram.
- [ ] The implementation and citizen-facing behavior identify Baileys as a staged hackathon transport rather than a production WhatsApp guarantee.
- [ ] No WhatsApp action or natural-language request exposes report or case status.

