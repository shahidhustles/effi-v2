# 06 - Build the officer case inbox

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

