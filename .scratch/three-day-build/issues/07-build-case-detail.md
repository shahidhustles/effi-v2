# 07 - Build the evidence-backed case detail

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

