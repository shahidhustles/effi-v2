# Engineering standards

Write code that is readable, cohesive, and easy to change. Match existing project conventions unless this file gives a stronger rule.

## Architecture

- Prefer small, deep modules: keep related behaviour local behind a simple interface.
- Extract a function or component when it has a clear name, independent responsibility, or meaningful reuse. Do not create abstractions or wrapper components without a real use.
- Name code after domain concepts, not vague technical terms such as `utils`, `helpers`, or `manager`.
- Keep comments for intent, trade-offs, and non-obvious constraints—not a narration of the code.
- Validate untrusted input at system boundaries. Keep external data typed and avoid `any`; use `unknown` and validate it when necessary.

### Use pnpm instead of npm.

## Code Review Graph (CRG)

Use CRG as the primary source for code relationships.

Prefer CRG over manual file searches, grep, or recursive scanning for:

- File relationships
- Function relationships
- Dependency analysis
- Call-chain tracing
- Impact analysis

Use direct code inspection only when CRG cannot provide the required information.

The goal is to minimize unnecessary searching, reduce token usage, and speed up code updates.

## Agent skills

### Issue tracker

Issues and specs are tracked as local Markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This monorepo uses multi-context domain docs. See `docs/agents/domain.md`.
