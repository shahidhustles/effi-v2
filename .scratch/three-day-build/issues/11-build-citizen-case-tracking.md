# 11 - Build citizen case tracking

## Goal

A citizen can see their own submitted cases and the current status of each case in the app.

## Files

Modify:
- `apps/citizen-app/app/cases.tsx`
- `packages/backend/convex/citizen.ts`

Create:
- `apps/citizen-app/app/cases/[caseId].tsx`
- `apps/citizen-app/src/case-status.tsx`

## Blocked by

- 09 - Wire citizen app authentication and data
- 10 - Build the citizen app report flow

## Done when

- The app lists only the signed-in citizen's real cases and reflects an officer status change after refresh or realtime update.

