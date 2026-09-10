# Effi three-day hackathon build

Status: active build plan. This spec replaces `.scratch/telegram-whatsapp-reporting/` for the three-day sprint. The larger root feature documents remain product backlog, not the build checklist for these three days.

## Goal

Ship one connected Effi demo in three days. Citizens can register a real civic report through Telegram, WhatsApp, or the citizen app. The report becomes a real Convex case. An officer can inspect and update that case in the dashboard.

The build is split into three broad categories:

1. Day 1: Telegram and WhatsApp reporting
2. Day 2: Officer dashboard
3. Day 3: Citizen app, deployment, and demo hardening

## Current state

### Already present

- Telegram has an Eve-native channel, text, image, GPS pin, voice, image assessment, confirmation, Clerk claim, Convex persistence, and report-ID acknowledgement code.
- Effi has shared report ingress, controlled media storage, voice providers, an anonymous draft model, and the basic report claim flow.
- The officer dashboard has Clerk and Convex providers plus the citizen claim page.
- The citizen app has Expo routing and shared UI packages.
- The separate `eve-wa-adapter` repository has a direct Eve custom channel for Baileys. It already handles QR login, reconnects, direct messages, text, images, GPS, voice, HITL replies, typing state, and completed-message delivery.

### Not yet proven or built

- Telegram has not passed a recorded live journey through bot message, photo, GPS, confirmation, Clerk, Convex, and Telegram acknowledgement.
- The current gateway test command discovers old Eve build snapshots and runs 1,564 tests instead of only the seven Effi gateway test files.
- The new WhatsApp adapter is not connected to Effi's ingress, evidence, Convex, claim, or acknowledgement flow. Its own dependencies are not installed in that checkout, so its current typecheck and build are unverified.
- Effi currently keeps two WhatsApp approaches. The new custom channel and the old Chat SDK transport must not survive as parallel implementations.
- A created case contains only `reportId` and `submitted`. There is no dashboard-ready case brief, priority, assignment, status workflow, case query, or officer audit data.
- The dashboard home page and citizen app are shells.

## User flow

1. A citizen sends an issue, photo, and location through Telegram or WhatsApp.
2. Effi asks only for missing information, shows its interpretation, and waits for explicit confirmation.
3. The citizen opens the claim link, signs in, and receives a report ID in the original channel.
4. Convex stores the report, source conversation, accepted evidence, case brief, priority recommendation, and initial case state.
5. An officer signs in, sees the new case, opens its evidence-backed brief, and can assign it, override priority, and update status.
6. A citizen can also sign in to the Expo app, submit issue text, one photo, and GPS coordinates, review the report, and see their submitted cases.

## Requirements

### Day 1: Telegram and WhatsApp reporting

- Keep one Effi agent and one reporting pipeline for both channels.
- Keep Telegram on Eve's native Telegram channel.
- Use the direct custom channel from `/Users/shahidpatel/codes/hackathons/eve-wa-adapter` as the WhatsApp transport.
- Adapt the WhatsApp transport to Effi. Do not copy the adapter's demo agent instructions into Effi and do not keep the old Chat SDK transport running beside it.
- Both channels must accept direct-message text, one image, and an exact GPS or selected-pin location.
- Both channels must show the final interpretation and require explicit confirmation.
- Both channels must complete the existing Clerk claim flow and return the created report ID to the original conversation.
- Voice must work for the chosen demo language in both channels if the configured speech providers succeed. Text fallback is acceptable when synthesis fails.
- Provider message deduplication and Effi-controlled media storage remain because they protect the visible demo from duplicate reports and expired media.
- Fix test discovery so the gateway test command ignores `.eve/**` snapshots. Add a regression test only for a bug found during the live flow.

### Day 2: Officer dashboard

- Store enough real case data for an inbox and detail page: summary, category, location, reported time, accepted evidence, priority and reasons, source conversation, status, and assignment.
- Show real Convex data. Do not hardcode fake cases into the dashboard.
- Protect officer pages with Clerk. A signed-out user sees sign-in, not case data.
- The inbox shows useful counts and a sortable case list.
- The case detail shows the brief, priority reasons, evidence, location, and original conversation.
- An officer can assign the case, override priority, and move it through the existing valid status sequence.
- Every officer change creates a small audit entry.

### Day 3: Citizen app and demo hardening

- "Complete app" means the smallest judge-visible citizen app: sign in, submit issue text plus one photo plus GPS, review, create a report, and view the citizen's own cases.
- Reuse the same Convex report and case records. Do not create an app-only fake store.
- Telegram and WhatsApp voice remain required Day 1 work. Voice input and output inside the Expo app are stretch work.
- The app does not need chat clarification, video, heat maps, or cross-channel continuation during the three-day build.
- Deploy or run every required service from one short runbook.
- Rehearse one clean demo from citizen input to officer action and record known fallbacks.

## Implementation decisions

- Keep `apps/bot-gateway` as the always-on Eve process. Baileys needs a persistent process and durable auth directory.
- Preserve Effi's existing report domain, evidence storage, Convex claim, and acknowledgement code where it helps the visible flow. Do not rewrite working pieces just to match the separate adapter.
- Replace the current WhatsApp channel boundary with the custom-channel transport. Keep Effi-specific normalization and report state outside the transport wherever practical.
- Use Convex as the shared source of truth for submitted reports and cases.
- Build the case brief from the citizen-confirmed interpretation and source evidence already gathered during reporting. Do not add a separate multi-agent investigation system.
- Keep the current linear case statuses: `new`, `assigned`, `under_inspection`, `work_in_progress`, and `resolved`.
- Use focused checks: typecheck the touched package, run only its source tests, then prove the ticket by hand. A green unit suite never replaces the live channel or browser flow.
- Do not spend time on production-grade retention, horizontal scaling, complex retry systems, or exhaustive provider mocks during these three days.

## Demo / acceptance

- [ ] Telegram creates one real Convex report from text, photo, GPS, confirmation, and Clerk sign-in, then replies with its report ID.
- [ ] Telegram completes one voice turn in the chosen demo language.
- [ ] WhatsApp links by QR, completes the same report flow from a second account, and replies with its report ID.
- [ ] The officer dashboard shows both real reports and their evidence-backed case details.
- [ ] An officer can assign a case, change its priority, advance its status, and see those changes in audit history.
- [ ] The citizen app can create one real report with issue text, photo, and GPS and then display that citizen's cases.
- [x] The gateway test command runs only the intended Effi tests, not copied `.eve` snapshots.
- [ ] A fresh-machine runbook identifies commands, environment groups, QR/webhook steps, and the exact demo order.

## Out of scope

- Voice input and voice replies inside the Expo citizen app
- Video reporting or analysis
- Ask Effi or RAG
- Duplicate and recurrence detection
- Heat maps and advanced analytics
- Case-status lookup through Telegram or WhatsApp
- Cross-channel identity or conversation continuation
- Production WhatsApp guarantees
- Complex retention and erasure work beyond what already exists
- More provider abstractions unless a live demo failure requires one
- Broad test generation, coverage targets, or tests for dependency internals
- Automated officer assignment, escalation, or resolution verification

See `stretch-backlog.md` for the ordered list to attempt after the core demo is stable.
