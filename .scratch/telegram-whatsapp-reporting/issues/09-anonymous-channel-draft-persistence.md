# 09 — Anonymous channel draft persistence

**What to build:** A citizen can leave an incomplete direct-message report in Telegram or WhatsApp and return to the same chat within seven days without repeating their description, voice transcript, photo, location, or corrections. The gateway resumes one isolated anonymous report draft from Convex after a service restart, while a different sender or channel cannot enter that draft.

**Blocked by:** None — can start immediately.

**Files:**

- Change: `packages/backend/convex/schema.ts`, `apps/bot-gateway/src/report-ingress.ts`, `apps/bot-gateway/agent/lib/reporting.ts`, `apps/bot-gateway/agent/channels/telegram.ts`, `apps/bot-gateway/agent/channels/whatsapp.ts`, `apps/bot-gateway/tests/telegram-channel-adapter.test.ts`, and `apps/bot-gateway/tests/whatsapp-channel.test.ts`.
- Create: `packages/backend/convex/reporting.ts`, `apps/bot-gateway/src/convex-report-store.ts`, and `apps/bot-gateway/tests/durable-reporting.test.ts`.

**Status:** ready-for-agent

- [ ] Every normalized inbound event is stored in Convex before model processing, including text, voice transcripts, media references, exact coordinates, evidence decisions, and report phase.
- [ ] A deterministic opaque scope derived from channel, sender identity, and direct-message conversation identity finds the same active draft without indexing a raw provider identity for lookup.
- [ ] Returning through the original direct-message channel within seven days resumes the correct draft and reconstructs only the durable report context needed for the next agent turn.
- [ ] Direct-message drafts from distinct senders, channels, completed reports, and cancelled reports are memory-isolated.
- [ ] A process restart during an incomplete report preserves the draft and permits the next provider message to continue it.
- [ ] Behavioral tests prove restart-safe resumption with text, voice transcript, accepted image evidence, and exact location in both channel adapters.
