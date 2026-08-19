# 12 — Anonymous draft lifecycle and erasure

**What to build:** A citizen can abandon or deliberately replace an anonymous report without old details leaking into the next one. Effi retains an unfinished draft for seven days, then removes its anonymous conversation content and controlled media; a later message starts an isolated report.

**Blocked by:** 09 — Anonymous channel draft persistence.

**Files:**

- Change: `packages/backend/convex/schema.ts`, `packages/backend/convex/reporting.ts`, `apps/bot-gateway/src/convex-report-store.ts`, `apps/bot-gateway/src/report-ingress.ts`, `apps/bot-gateway/agent/channels/telegram.ts`, `apps/bot-gateway/agent/channels/whatsapp.ts`, and `apps/bot-gateway/tests/durable-reporting.test.ts`.
- Create: `packages/backend/convex/crons.ts` for seven-day expiry and cleanup.

**Status:** ready-for-agent

- [ ] Exactly one unfinished draft is active for an anonymous direct-message scope at a time.
- [ ] A citizen can explicitly start a new report, making the previous unfinished draft unavailable for resumption and beginning a clean conversation immediately.
- [ ] Unclaimed drafts expire seven days after their last activity; expired draft messages, transcripts, attachment references, and controlled media are removed together.
- [ ] A message after cancellation or expiry begins a new isolated draft even when it arrives from the same Telegram user or WhatsApp number.
- [ ] Successfully claimed reports remain outside anonymous-draft expiry and retain their original conversation and evidence as report records.
- [ ] Behavioral tests prove cancellation, seven-day expiry, media erasure, fresh-draft creation, and no cross-report state leakage.
