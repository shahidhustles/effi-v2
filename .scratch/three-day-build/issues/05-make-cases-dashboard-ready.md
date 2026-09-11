# 05 - Make submitted cases dashboard-ready

## Goal

Every authenticated claim creates one complete case that the officer inbox and detail page can query immediately. The case contains the citizen-confirmed facts, an evidence-backed brief and priority recommendation, accepted evidence, and an immutable two-sided transcript.

## User flow

1. The citizen reviews and confirms Effi's interpretation in Telegram or WhatsApp.
2. During `prepare_submission`, the Eve model creates the short case brief and priority recommendation from that confirmed interpretation and its cited source messages or evidence.
3. Convex validates the cited transcript and evidence, derives the reported time from the first citizen message, and stores the pending submission behind the opaque claim token.
4. The citizen signs in through Clerk and claims the submission.
5. One Convex transaction creates the report, case, normalized transcript rows, and initial audit entry.
6. An authenticated officer can list the case and open its complete source data through officer-only queries.

## Requirements

- Use only the confirmed issue, category, exact coordinates, accepted evidence, and persisted transcript. Do not infer new case facts during claim.
- Require the model to provide a plain-language summary, recommended priority, at least one priority reason, and source citations before creating the pending submission.
- Reject an invalid brief or unsupported category, priority, location source, evidence reference, or transcript entry. Do not replace missing model output with fake defaults.
- Derive `reportedAt` from the first persisted citizen message and `submittedAt` from the authenticated claim. Do not trust model-supplied timestamps.
- Preserve accepted evidence metadata needed by Ticket 07, including attachment ID, storage key, media type, and source message ID.
- Create the case with recommended and current priority equal, status `new`, and no assignment.
- Copy the report transcript into normalized case transcript rows during the claim transaction. Preserve sequence, direction, timestamp, citizen text or voice transcript, locations, accepted attachment references, Effi text, and structured question options.
- Keep case transcript rows immutable. Later officer actions belong in audit records, not the original conversation.
- Make claim retries idempotent. The existing claimed report must return without creating another case or transcript copy.
- Allow only authenticated Effi identities with role `officer` or `admin` to read the case list or case detail.

## Data changes

### `pendingSubmissions`

Add required fields now that the development table is empty:

- `reportedAt`
- `caseBrief`, containing summary, priority recommendation, reasons, and source citations
- accepted evidence metadata beyond the existing attachment ID and storage key

### `cases`

Replace the thin submitted marker with:

- report reference and report number
- summary and category
- exact location
- reported and submitted timestamps
- recommended priority, current priority, reasons, and citations
- accepted evidence metadata
- source channel and conversation ID
- status `new`
- optional assigned officer identity

Indexes must support the next tickets without table scans:

- status plus submitted time
- priority plus submitted time
- report ID

### `caseTranscriptMessages`

Create a child table instead of storing the conversation as an array on the case:

- case ID
- original transcript sequence
- direction, `citizen` or `effi`
- occurred time
- a validated content union for citizen messages, Effi messages, and structured input requests

Index by case ID and sequence for ordered detail reads.

## Contract changes

- Expand `CaseBriefV1` in `packages/ai-contracts/src/index.ts` so category and priority use the shared domain enums and citations point to a transcript message or accepted evidence item.
- Expand the `prepare_submission` input in `apps/bot-gateway/agent/tools/prepare_submission.ts` with the validated brief fields. The model creates them while it has the reviewed conversation in context.
- Expand `PendingSubmission` and `ConvexReportStore.persistPendingSubmission` so the evidence metadata and case brief reach Convex unchanged. Convex derives source timestamps and verifies every citation against the stored draft.
- Keep the opaque authentication link and existing gateway service-secret boundary.

## Convex functions

### Mutations

- Extend `reporting.createPendingSubmission` to validate and store the complete dashboard-ready snapshot.
- Extend `reporting.claimAuthenticatedSubmission` to atomically create the report, case, normalized case transcript rows, and initial claim audit event, then mark the pending submission and draft complete.
- Add an internal development provisioning mutation for the one Clerk officer identity used in the demo. It must not be callable by dashboard clients.
- Do not add assignment, priority override, or status-transition mutations. Ticket 08 owns those officer actions.

### Queries

Create `packages/backend/convex/cases.ts` with:

- `listCases`, a bounded officer-only inbox query returning the fields needed by Ticket 06 in submitted-time order
- `getCase`, an officer-only detail query returning the case, accepted evidence, and ordered transcript needed by Ticket 07

Both queries derive the Clerk identity server-side, resolve its Effi identity record, and reject citizen or unknown roles.

## Files

Modify:

- `packages/backend/convex/schema.ts`
- `packages/backend/convex/reporting.ts`
- `packages/domain/src/index.ts`
- `packages/ai-contracts/src/index.ts`
- `apps/bot-gateway/src/simulated-report-registration.ts`
- `apps/bot-gateway/src/convex-report-store.ts`
- `apps/bot-gateway/agent/tools/prepare_submission.ts`
- focused gateway and backend tests for the changed contracts

Create:

- `packages/backend/convex/cases.ts`

## Demo / acceptance

- [x] A new Telegram claim creates exactly one report and one case with its real summary, category, coordinates, reported time, accepted photo metadata, recommended priority, reasons, citations, `new` status, and empty assignment.
- [ ] A new WhatsApp claim creates the same complete records through the shared pipeline.
- [x] Each case has an ordered immutable transcript containing both citizen and delivered Effi messages, including the interpretation and confirmation prompt.
- [ ] Repeating the same claim returns the original report number and leaves one case and one transcript copy.
- [ ] A provisioned officer can list and open both cases through Convex queries.
- [x] A signed-out caller, citizen identity, or unknown identity cannot read case data.
- [x] Gateway typecheck, focused gateway tests, backend typecheck, backend tests, and `convex dev --once` pass.

## Human test

1. Start Convex, the dashboard, and the bot gateway with the normal development commands.
2. Submit and claim one Telegram report containing text or voice, one accepted photo, exact GPS, review, and confirmation.
3. Submit and claim one equivalent WhatsApp report.
4. Inspect Convex and confirm there are two reports, two cases, and two ordered case transcripts with both directions.
5. Call the case list and detail queries as the provisioned officer and confirm both cases expose only real stored data.
6. Repeat one claim and confirm the report, case, and transcript counts do not increase.
7. Call a case query signed out and as a citizen, and confirm both requests fail without returning case data.

## Blocked by

- 04 - Prove both messaging channels
- 04a - Persist two-sided report transcripts

## Out of scope

- Officer assignment, priority overrides, status transitions, and officer audit entries
- Dashboard components, filters, sorting controls, maps, or evidence rendering
- A separate investigation agent or another model call during claim
- Backfilling deleted development cases
- Related-case detection, recurrence scoring, SLA logic, escalation, or analytics
