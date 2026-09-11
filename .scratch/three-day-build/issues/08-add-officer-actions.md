# 08 - Add officer actions and audit history

Status: Complete

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

## Decisions

- Assignment assigns the case to the signed-in officer and moves it from New to Assigned in one transaction.
- The assigned officer and administrators can change an assigned case. Other officers have read-only access.
- Priority overrides do not require a note.
- Resolving a case requires confirmation and a resolution note. Resolved cases remain closed.
- Audit history starts with the case registration time and records each officer action with an identity and Clerk name snapshot.

## Verification

- A real development case was assigned, changed from High to Critical, and advanced to Under inspection. Its officer-only query returned all four audit events immediately.
- The other two development cases remain New and unassigned for manual testing.
- Backend tests cover assignment, permission checks, priority override without a note, every forward status change, resolution-note validation, and administrator access.
- The backend, case-workflow package, and officer dashboard pass typecheck, lint, tests, and production builds.

## Human test

1. Sign in and open either remaining New case from the inbox.
2. Select Assign to me. Confirm the assignment and status change appear in the action panel and audit history.
3. Change the priority. Confirm the badge and audit history update without asking for a note.
4. Advance the case through inspection and work in progress.
5. Select Resolve case. Confirm an empty resolution note is rejected, then add a note and resolve it.
6. Confirm the resolved case has no further action controls and the note appears in its audit history.
