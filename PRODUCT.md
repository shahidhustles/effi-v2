# Effi product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Citizens report local civic problems through Telegram, WhatsApp, or the citizen app. Municipal officers use the web dashboard to assess confirmed reports, inspect evidence, assign work, change priority, and move cases through resolution.

Ticket 06 focuses on officers who need to scan a live queue quickly, identify urgent work, and open a case without losing context.

## Product purpose

Effi turns a citizen's confirmed conversation, evidence, and location into one case shared by the citizen and the officer workflow. Success means the same real report remains traceable from submission through officer action.

## Positioning

Effi keeps citizen reporting and municipal case handling in one evidence-backed record. Telegram, WhatsApp, and the citizen app feed the same Convex case pipeline instead of separate channel-specific queues.

## Operating context

- Citizens may submit text, one accepted photo, exact GPS, and voice through messaging channels.
- Officers work from a signed-in desktop or mobile web dashboard.
- The case inbox updates from Convex and must support rapid scanning before an officer opens the full case detail.
- The hackathon demo must visibly connect citizen submission to officer handling.

## Capabilities and constraints

- Clerk protects officer routes. Signed-out users see sign-in, not case data.
- Convex is the source of truth for reports, cases, evidence, transcripts, assignment, priority, status, and audit history.
- Ticket 06 owns workload counts, status and priority filters, sorting, case rows, and loading, empty, access, and query-error states.
- Inbox values must come from live case records. Do not ship hardcoded cases or invented metrics.
- Preserve the status sequence: `new`, `assigned`, `under_inspection`, `work_in_progress`, and `resolved`.
- Preserve the existing route structure and case links.

## Brand commitments

- Product name: Effi.
- Voice: direct, calm, and useful. Buttons name actions. States explain the problem and recovery.
- `DESIGN.reference.md` is the visual reference. Keep its violet identity, Bricolage Grotesque and Inter pairing, friendly geometry, and bright canvas.
- Translate the reference for operational UI. The officer console must favor scan speed and clear state over landing-page decoration.

## Evidence on hand

- `.scratch/three-day-build/spec.md` defines the connected citizen-to-officer demo.
- `.scratch/three-day-build/issues/06-build-the-case-inbox.md` defines Ticket 06 acceptance.
- `DESIGN.reference.md` contains the supplied Supahub design reference.
- The repository contains the real Clerk, Convex, inbox state, and shared UI implementations.
- No customer claims, usage metrics, testimonials, or production performance evidence are available. Do not invent them.

## Product principles

- One real case across every channel and user view.
- Evidence before automation claims.
- Show the next useful action within seconds.
- Keep operational states explicit and recoverable.
- Prefer a narrow, working demo path over speculative features.

## Accessibility and inclusion

The dashboard must remain keyboard operable, expose meaningful loading and error announcements, preserve visible focus, and keep state meaning readable without relying on color alone.
