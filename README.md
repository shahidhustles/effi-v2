# Effi v2

Effi turns natural civic reports into evidence-backed cases officers can act on.

## Requirements

- Node.js 22 or later
- Corepack (`corepack enable`)

## Local setup

```sh
corepack enable
corepack pnpm install
corepack pnpm dev
```

Copy each deployable package's `.env.example` to `.env.local` before connecting Clerk or Convex. No external provider credentials are required to run the initial shells.

## Workspace

- `apps/officer-dashboard` — Next.js officer dashboard shell
- `apps/citizen-app` — Expo citizen app shell
- `packages/*` — stable civic-domain, UI, backend, and integration boundaries

Run `pnpm check` before opening a pull request.
