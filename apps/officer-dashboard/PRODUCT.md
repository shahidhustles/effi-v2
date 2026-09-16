# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Municipal field officers and operations leads use Effi while triaging, assigning, investigating, and resolving citizen-reported service issues.

## Product Purpose

Effi turns natural-language civic reports from Telegram, WhatsApp, and the citizen app into evidence-backed cases. Success means officers can understand the issue, act on it, preserve an auditable history, and keep service commitments visible.

## Positioning

Effi joins accessible, multi-channel citizen reporting with officer intelligence grounded in the original conversation, accepted evidence, exact location, service guidance, and human-controlled case decisions.

## Operating Context

Citizens report roads, sanitation, water, lighting, drainage, and other civic issues. Officers work from a real-time case inbox, location heatmap, case evidence and transcript, audit history, case-scoped assistant, and municipal SLA guidance.

## Capabilities and Constraints

- Convex owns reports, cases, assignments, priorities, statuses, audit events, citizen reposts, transcripts, and evidence references.
- Clerk identity and the Convex officer or admin role gate officer data.
- Analytics must derive from persisted product data and clearly label categories without an applicable service target.
- Officer priority overrides are human decisions, not ground-truth labels for model accuracy.
- The initial analytics surface is an operational command center, not a public performance report or competitive officer leaderboard.

## Brand Commitments

The product name is Effi. Existing dashboard language is plain, calm, civic, and action-oriented. Preserve the current officer workspace navigation, typography, palette, and civic-dome brand asset.

## Evidence on Hand

- Live product entities and event history in `packages/backend/convex/schema.ts` and `packages/backend/convex/cases.ts`.
- A demo municipal operations manual with category-specific targets and escalation thresholds in `content/effi-municipal-operations-manual-demo-v1.json`.
- Existing officer case inbox, case detail, heatmap, citizen reporting, and citizen repost flows.
- No verified public benchmarks, production service-level claims, or validated model-accuracy labels. Do not fabricate them.

## Product Principles

- Lead with the next operational decision.
- Show the evidence behind every recommendation.
- Keep human authority visible and measurable.
- Separate real measurements from inferred risk.
- Prefer honest unavailable states over invented data.

## Accessibility & Inclusion

Officer workflows must remain keyboard accessible, readable without color alone, responsive down to mobile widths, and compatible with reduced-motion preferences.
