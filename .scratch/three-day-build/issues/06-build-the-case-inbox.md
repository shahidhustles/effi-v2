# 06 - Build the officer case inbox

Status: Complete

## Goal

An officer sees live Convex cases and useful workload counts on the dashboard home page.

## Files

Modify:
- `apps/officer-dashboard/app/page.tsx`
- `apps/officer-dashboard/app/globals.css`
- `packages/ui-web/src/index.tsx`
- `packages/design-tokens/src/web.css`

Create:
- `apps/officer-dashboard/components/case-inbox.tsx`

## Implementation notes

Show real loading, empty, and error states. Keep filters to status and priority unless the live case volume proves another filter useful.

## Blocked by

- 05 - Make submitted cases dashboard-ready

## Done when

- A newly submitted Telegram or WhatsApp case appears in the inbox without hardcoded data and opens from the list.

## Verification

- The inbox subscribes to the officer-only `cases:listCases` Convex query and contains no fallback case records.
- An authenticated dashboard capture on 2026-09-11 showed three persisted Telegram and WhatsApp cases with their report numbers, priorities, statuses, and submitted times.
- Selecting a case opens its real inbox data in a native dialog. Close and Escape both dismiss it. Ticket 07 owns the full evidence-backed detail page.
- `pnpm --filter @effi/officer-dashboard typecheck`, lint, 11 focused tests, and the production build pass.
