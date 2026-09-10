# 08 - Add officer actions and audit history

## Goal

An authenticated officer can assign a case, override priority, and advance status while Effi records who changed what.

## Files

Modify:
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/cases.ts`
- `packages/case-workflow/src/index.ts`
- `apps/officer-dashboard/proxy.ts`
- `apps/officer-dashboard/app/cases/[caseId]/page.tsx`

Create:
- `apps/officer-dashboard/components/case-actions.tsx`
- `apps/officer-dashboard/components/case-audit.tsx`

## Implementation notes

Use Clerk identity at the Convex mutation boundary. Keep the existing linear status sequence. Do not add escalation, SLA, or autonomous assignment.

## Blocked by

- 07 - Build the evidence-backed case detail

## Done when

- A signed-in officer can assign, reprioritize, and advance a real case, and each change appears immediately in its audit history.

