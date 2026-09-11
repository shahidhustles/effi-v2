# 07 - Build the evidence-backed case detail

Status: Complete

## Goal

An officer can inspect the case brief, priority reasons, location, accepted evidence, and original citizen conversation on one detail page.

## Files

Create:
- `apps/officer-dashboard/app/cases/[caseId]/page.tsx`
- `apps/officer-dashboard/components/case-brief.tsx`
- `apps/officer-dashboard/components/evidence-viewer.tsx`
- `apps/officer-dashboard/components/source-conversation.tsx`

Modify:
- `apps/officer-dashboard/app/globals.css`
- `packages/backend/convex/cases.ts`

## Blocked by

- 05 - Make submitted cases dashboard-ready
- 06 - Build the officer case inbox

## Done when

- Opening a real case shows its confirmed facts, accepted image, priority explanation, coordinates, and original messages with no fake fallback content.

## Verification

- The officer-only case query returned a real development case with one resolved Convex Storage image URL and all eight transcript messages.
- All three existing development evidence images were uploaded to Convex Storage, and their storage IDs were saved with the pending submission, report, case, and transcript records.
- New accepted evidence is uploaded to Convex Storage before a pending submission is saved; missing or invalid storage objects are rejected.
- The dashboard typecheck, lint, tests, and production build pass, including the dynamic `/cases/[caseId]` route.
- The backend typecheck, lint, tests, and build pass. The focused gateway upload tests pass for successful and failed uploads.
