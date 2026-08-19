# 13 — Durable authenticated reporting acceptance

**What to build:** Final proof that both direct-message bots provide the durable P0 reporting journey: a citizen can resume an anonymous draft, explicitly confirm it, claim it through Clerk, and receive exactly one report ID, with the resulting report ready for the shared case pipeline.

**Blocked by:** 08 — Cross-channel P0 acceptance; 11 — Clerk report claim and channel acknowledgement; 12 — Anonymous draft lifecycle and erasure.

**Files:**

- Change: `apps/bot-gateway/tests/telegram-channel-adapter.test.ts`, `apps/bot-gateway/tests/whatsapp-channel.test.ts`, `apps/officer-dashboard/app/effi/auth/[claimToken]/page.test.tsx`, and `apps/bot-gateway/README.md` if live smoke-test steps change.
- Create: `apps/bot-gateway/tests/durable-authenticated-reporting.test.ts`.

**Status:** completed

- [x] Telegram and WhatsApp each prove a restart-safe incomplete-report journey that resumes the same anonymous sender-and-conversation scope before the seven-day expiry.
- [x] Both channels prove the complete claim journey from explicit confirmation through Clerk sign-in to one durable report, initial case, audit event, browser confirmation, and original-channel report-ID acknowledgement.
- [x] Repeated confirmation, browser refresh, authentication callback retry, and provider delivery cannot create duplicate pending submissions, reports, cases, or acknowledgements.
- [x] Claim URLs contain no citizen report details, coordinates, media references, or application record identifiers.
- [x] Cancellation, explicit new-report, and seven-day expiry prove that stale anonymous messages and media cannot reappear in a later report.
- [x] Relevant type checks, behavioral tests, and both-channel staged-data smoke tests pass, with any unrelated failures identified separately.
