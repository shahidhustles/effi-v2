# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
See [workflow/taste.md](workflow/taste.md)
# git
- Commit completed work to the current branch. Confidence: 0.75

# tech-stack
- Use PNPM + Turborepo monorepo workspace; apps (officer-dashboard, citizen-app, bot gateway) live in `apps/` while stable domain/platform boundaries go in `packages/`. Confidence: 0.80
- Use Convex as the shared backend and Clerk for authentication; Convex is the durable single source of truth for reports and acknowledgement state. Confidence: 0.80
- Use TypeScript with strict mode enabled across the workspace. Confidence: 0.75

