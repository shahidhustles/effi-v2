# 11 — Clerk report claim and channel acknowledgement

**What to build:** A citizen opens the bot-delivered claim link, signs in with Clerk using Google or email, sees a clear browser confirmation, and receives one acknowledgement with a report ID in the originating Telegram or WhatsApp conversation. Effi atomically turns the immutable pending submission into the authenticated citizen, report, initial case, and audit event.

**Blocked by:** 10 — Immutable pending-submission claim.

**Files:**

- Change: `packages/backend/convex/schema.ts`, `packages/backend/convex/reporting.ts`, `apps/bot-gateway/src/report-authentication.ts`, `apps/bot-gateway/agent/channels/telegram-auth.ts`, `apps/bot-gateway/agent/channels/whatsapp.ts`, `apps/officer-dashboard/app/providers.tsx`, and `apps/officer-dashboard/.env.example`.
- Create: `apps/officer-dashboard/app/effi/auth/[claimToken]/page.tsx` and `apps/officer-dashboard/app/effi/auth/[claimToken]/page.test.tsx`.

**Status:** ready-for-agent

- [ ] The authentication page supports Clerk sign-in and returns the authenticated citizen to the pending claim without exposing submission content in browser state or URLs.
- [ ] Successful claim completion atomically creates or returns one authenticated citizen identity, report, initial case, and submission audit event from the frozen pending submission.
- [ ] A refresh, Clerk callback retry, provider retry, or concurrent completion returns the same report ID and never creates a second report, case, or acknowledgement.
- [ ] The browser confirms the registered report clearly, while an expired, invalid, or already-claimed link produces a safe recovery state.
- [ ] The originating channel receives one acknowledgement containing the created report ID after successful claim completion.
- [ ] End-to-end tests prove both Google/email-compatible Clerk completion seams, atomic idempotency, browser recovery states, and one original-channel acknowledgement.
