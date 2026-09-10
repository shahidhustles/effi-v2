# 05 - Make submitted cases dashboard-ready

## Goal

Every claimed report creates a case record that contains the real brief, evidence, priority recommendation, status, assignment, and source data the dashboard needs.

## Files

Modify:
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/reporting.ts`
- `packages/domain/src/index.ts`
- `packages/ai-contracts/src/index.ts`
- `apps/bot-gateway/agent/tools/prepare_submission.ts`

Create:
- `packages/backend/convex/cases.ts`

## Implementation notes

Use the confirmed report interpretation and persisted source messages. No fake case rows and no separate investigation agent.

## Blocked by

- 04 - Prove both messaging channels

## Done when

- Claiming a report creates one queryable case with summary, category, coordinates, evidence, priority plus reasons, source messages, `new` status, and empty assignment.

