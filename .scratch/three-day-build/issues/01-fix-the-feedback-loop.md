# 01 - Fix the gateway feedback loop

Status: completed

## Goal

Make the bot gateway's normal test command run only Effi's source tests instead of every copied test under Eve build snapshots.

## Files

Create:
- `apps/bot-gateway/vitest.config.ts`

Modify:
- `apps/bot-gateway/package.json`

## Implementation notes

Exclude `.eve/**`, build output, and dependencies. Do not delete or rewrite the existing seven source test files.

## Blocked by

None.

## Done when

- `pnpm --filter @effi/bot-setup test` discovers only the seven intended gateway test files and no `.eve/dev-runtime/snapshots` paths.

## Result

- Vitest now runs 7 files and 68 tests.
- Gateway tests, typecheck, lint, and `git diff --check` pass.
- The 190 MB generated snapshot directory was moved to macOS Trash and can be restored until Trash is emptied.
