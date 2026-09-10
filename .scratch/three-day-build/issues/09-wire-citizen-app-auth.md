# 09 - Wire citizen app authentication and data

## Goal

The Expo app signs a citizen in and can read and write that citizen's Convex data.

## Files

Modify:
- `apps/citizen-app/app/_layout.tsx`
- `apps/citizen-app/app/index.tsx`
- `apps/citizen-app/.env.example`
- `apps/citizen-app/package.json`
- `pnpm-lock.yaml`

Create:
- `apps/citizen-app/src/providers.tsx`
- `packages/backend/convex/citizen.ts`

## Blocked by

- 05 - Make submitted cases dashboard-ready

## Done when

- A signed-out app user can sign in and a signed-in user sees their real account state without exposing another citizen's reports.

