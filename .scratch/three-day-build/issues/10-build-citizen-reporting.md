# 10 - Build the citizen app report flow

## Goal

A signed-in citizen can submit issue text, one photo, and current GPS coordinates after reviewing the complete report.

## Files

Modify:
- `apps/citizen-app/app/report.tsx`
- `apps/citizen-app/package.json`
- `pnpm-lock.yaml`
- `packages/backend/convex/schema.ts`
- `packages/backend/convex/citizen.ts`

Create:
- `apps/citizen-app/src/report-draft.ts`
- `apps/citizen-app/src/report-media.ts`

## Implementation notes

Use Expo's image and location APIs and the shared Convex case pipeline. The app flow can be a compact review form. Do not rebuild the Telegram or WhatsApp conversational agent in React Native.

## Blocked by

- 09 - Wire citizen app authentication and data

## Done when

- One signed-in app user captures or selects a photo, grants location, reviews the issue and coordinates, submits once, and the resulting case appears in the officer inbox.

